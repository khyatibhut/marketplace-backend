import { Request, Response } from 'express';
import mongoose from 'mongoose';
import { sendSuccess, sendError } from '../utils/response';
import { Rating } from '../models/Rating';
import { createRatingSchema } from '../utils/validators';
import { getPagination } from '../utils/common';

export const createRating = async (req: Request, res: Response) => {
  try {
    const validatedData = createRatingSchema.parse(req.body);

    // Prevent duplicate ratings for the same product and order
    const existing = await Rating.findOne({
      orderId: validatedData.orderId,
      productId: validatedData.productId,
      buyerId: req.user.id
    }).lean();

    if (existing) {
      return sendError(res, 409, 'You have already rated this product for this order');
    }

    const rating = await Rating.create({
      ...validatedData,
      buyerId: req.user.id
    });

    sendSuccess(res, 201, 'Rating submitted successfully', { rating });
  } catch (error: any) {
    if (error.name === 'ZodError') {
      return sendError(res, 400, 'Validation error', error.errors);
    }
    sendError(res, 500, 'Error creating rating', error.message);
  }
};

export const getProductRatings = async (req: Request, res: Response) => {
  try {
    const productId = req.params.productId;
    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return sendError(res, 400, 'Invalid Product ID');
    }

    const { skip, limit, paginate } = getPagination(req);
    const objectId = new mongoose.Types.ObjectId(productId);

    const aggregationResult = await Rating.aggregate([
      { $match: { productId: objectId } },
      {
        $facet: {
          metadata: [
            {
              $group: {
                _id: null,
                totalRatings: { $sum: 1 },
                averageScore: { $avg: '$score' }
              }
            }
          ],
          ratings: [
            { $sort: { createdAt: -1 } },
            { $skip: skip },
            { $limit: limit },
            {
              $lookup: {
                from: 'users',
                localField: 'buyerId',
                foreignField: '_id',
                as: 'buyer'
              }
            },
            { $unwind: '$buyer' },
            {
              $project: {
                _id: 1,
                score: 1,
                comment: 1,
                createdAt: 1,
                'buyer.name': 1
              }
            }
          ]
        }
      }
    ]);

    const result = aggregationResult[0];
    const total = result.metadata[0]?.totalRatings || 0;
    const averageScore = Number((result.metadata[0]?.averageScore || 0).toFixed(1));

    sendSuccess(res, 200, 'Product ratings fetched successfully', {
      stats: { total, averageScore },
      ratings: result.ratings,
      pagination: paginate(total)
    });
  } catch (error: any) {
    sendError(res, 500, 'Error fetching product ratings', error.message);
  }
};
