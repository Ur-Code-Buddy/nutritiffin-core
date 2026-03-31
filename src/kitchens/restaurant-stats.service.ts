import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export interface RestaurantTopItemStat {
  name: string;
  average_rating: number;
  total_ratings: number;
}

export interface RestaurantStatsResponse {
  total_orders: number;
  total_customers: number;
  average_rating: number | null;
  total_ratings: number;
  rating_distribution: Record<'1' | '2' | '3' | '4' | '5', number>;
  top_items: RestaurantTopItemStat[];
}

@Injectable()
export class RestaurantStatsService {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  async getStats(kitchenId: string): Promise<RestaurantStatsResponse> {
    const [
      ordersRow,
      customersRow,
      aggRow,
      distRows,
      topRows,
    ] = await Promise.all([
      this.dataSource.query<{ c: string }[]>(
        `SELECT COUNT(*)::text AS c FROM orders WHERE kitchen_id = $1 AND status = 'DELIVERED'`,
        [kitchenId],
      ),
      this.dataSource.query<{ c: string }[]>(
        `SELECT COUNT(DISTINCT client_id)::text AS c FROM orders WHERE kitchen_id = $1 AND status = 'DELIVERED'`,
        [kitchenId],
      ),
      this.dataSource.query<
        { avg: string | null; total: string }[]
      >(
        `SELECT AVG(r.stars::numeric)::text AS avg, COUNT(*)::text AS total
         FROM reviews r
         INNER JOIN food_items f ON f.id = r.food_item_id AND f.kitchen_id = $1`,
        [kitchenId],
      ),
      this.dataSource.query<{ stars: string; c: string }[]>(
        `SELECT r.stars::text AS stars, COUNT(*)::text AS c
         FROM reviews r
         INNER JOIN food_items f ON f.id = r.food_item_id AND f.kitchen_id = $1
         GROUP BY r.stars`,
        [kitchenId],
      ),
      this.dataSource.query<
        { name: string; avg_stars: string; cnt: string }[]
      >(
        `SELECT f.name AS name,
                AVG(r.stars::numeric)::text AS avg_stars,
                COUNT(*)::text AS cnt
         FROM reviews r
         INNER JOIN food_items f ON f.id = r.food_item_id AND f.kitchen_id = $1
         GROUP BY f.id, f.name
         HAVING COUNT(*) >= 3
         ORDER BY AVG(r.stars::numeric) DESC NULLS LAST
         LIMIT 5`,
        [kitchenId],
      ),
    ]);

    const total_orders = parseInt(ordersRow[0]?.c ?? '0', 10);
    const total_customers = parseInt(customersRow[0]?.c ?? '0', 10);
    const total_ratings = parseInt(aggRow[0]?.total ?? '0', 10);
    const rawAvg = aggRow[0]?.avg;
    const average_rating =
      total_ratings > 0 && rawAvg != null
        ? Math.round(parseFloat(rawAvg) * 100) / 100
        : null;

    const rating_distribution: Record<
      '1' | '2' | '3' | '4' | '5',
      number
    > = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    for (const row of distRows) {
      const k = row.stars as '1' | '2' | '3' | '4' | '5';
      if (k in rating_distribution) {
        rating_distribution[k] = parseInt(row.c, 10);
      }
    }

    const top_items: RestaurantTopItemStat[] = topRows.map((row) => ({
      name: row.name,
      average_rating: Math.round(parseFloat(row.avg_stars) * 100) / 100,
      total_ratings: parseInt(row.cnt, 10),
    }));

    return {
      total_orders,
      total_customers,
      average_rating,
      total_ratings,
      rating_distribution,
      top_items,
    };
  }
}
