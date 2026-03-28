import {
  Injectable,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Kitchen } from './entities/kitchen.entity';
import { CreateKitchenDto } from './dto/create-kitchen.dto';
import { UpdateKitchenDto } from './dto/update-kitchen.dto';

@Injectable()
export class KitchensService {
  constructor(
    @InjectRepository(Kitchen)
    private kitchensRepository: Repository<Kitchen>,
  ) {}

  async create(createKitchenDto: CreateKitchenDto): Promise<Kitchen> {
    const existing = await this.kitchensRepository.findOne({
      where: { owner_id: createKitchenDto.owner_id },
    });
    if (existing) {
      throw new ConflictException('Owner already has a kitchen.');
    }
    const { latitude, longitude, ...rest } = createKitchenDto;
    const kitchen = this.kitchensRepository.create({
      ...rest,
      ...(latitude !== undefined ? { latitude: String(latitude) } : {}),
      ...(longitude !== undefined ? { longitude: String(longitude) } : {}),
    });
    return this.kitchensRepository.save(kitchen);
  }

  findAll() {
    return this.kitchensRepository.find({
      where: { is_active: true },
    });
  }

  async findOne(id: string) {
    const kitchen = await this.kitchensRepository.findOne({ where: { id } });
    if (!kitchen) {
      throw new NotFoundException(`Kitchen with ID ${id} not found`);
    }
    return kitchen;
  }

  async findByOwner(ownerId: string) {
    return this.kitchensRepository.findOne({ where: { owner_id: ownerId } });
  }

  async setAutoAcceptOrders(ownerId: string, enabled: boolean) {
    const kitchen = await this.findByOwner(ownerId);
    if (!kitchen) {
      throw new NotFoundException('No kitchen found for this account');
    }
    await this.kitchensRepository.update(kitchen.id, { auto_accept_orders: enabled });
    return this.findOne(kitchen.id);
  }

  async update(id: string, updateKitchenDto: UpdateKitchenDto) {
    const { latitude, longitude, ...rest } = updateKitchenDto;
    const payload: Record<string, unknown> = { ...rest };
    if (latitude !== undefined) {
      payload.latitude = String(latitude);
    }
    if (longitude !== undefined) {
      payload.longitude = String(longitude);
    }
    await this.kitchensRepository.update(id, payload as any);
    return this.findOne(id);
  }

  async remove(id: string) {
    await this.kitchensRepository.delete(id);
    return { deleted: true };
  }
}
