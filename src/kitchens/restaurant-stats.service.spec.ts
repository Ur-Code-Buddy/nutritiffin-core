import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { RestaurantStatsService } from './restaurant-stats.service';

describe('RestaurantStatsService', () => {
  let service: RestaurantStatsService;
  let query: jest.Mock;

  beforeEach(async () => {
    query = jest.fn();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RestaurantStatsService,
        {
          provide: getDataSourceToken(),
          useValue: { query },
        },
      ],
    }).compile();

    service = module.get(RestaurantStatsService);
  });

  it('aggregates stats from parallel queries', async () => {
    query
      .mockResolvedValueOnce([{ c: '12' }])
      .mockResolvedValueOnce([{ c: '7' }])
      .mockResolvedValueOnce([{ avg: '4.256', total: '22' }])
      .mockResolvedValueOnce([
        { stars: '5', c: '10' },
        { stars: '4', c: '12' },
      ])
      .mockResolvedValueOnce([
        { name: 'Dal', avg_stars: '4.666666', cnt: '9' },
        { name: 'Roti', avg_stars: '3.5', cnt: '4' },
      ]);

    const result = await service.getStats('kitchen-uuid');

    expect(result.total_orders).toBe(12);
    expect(result.total_customers).toBe(7);
    expect(result.total_ratings).toBe(22);
    expect(result.average_rating).toBe(4.26);
    expect(result.rating_distribution['5']).toBe(10);
    expect(result.rating_distribution['4']).toBe(12);
    expect(result.rating_distribution['1']).toBe(0);
    expect(result.top_items).toHaveLength(2);
    expect(result.top_items[0]).toEqual({
      name: 'Dal',
      average_rating: 4.67,
      total_ratings: 9,
    });
  });

  it('returns null average and empty top_items when no ratings', async () => {
    query
      .mockResolvedValueOnce([{ c: '0' }])
      .mockResolvedValueOnce([{ c: '0' }])
      .mockResolvedValueOnce([{ avg: null, total: '0' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const result = await service.getStats('kitchen-uuid');

    expect(result.average_rating).toBeNull();
    expect(result.total_ratings).toBe(0);
    expect(result.top_items).toEqual([]);
  });
});
