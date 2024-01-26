import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model";
import { asyncHandler } from "../utils/asyncHandler.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  page = isNaN(page) ? 1 : Number(page);
  limit = isNan(limit) ? 10 : Number(limit);
  if (page < 0) {
    page = 1;
  }
  if (limit <= 0) {
    limit = 10;
  }
  const matchStage = {};
  if (userId && query) {
    matchStage["$match"] = {
      $and: [
        { owner: new mongoose.Types.ObjectId(userId) },
        {
          $or: [
            { title: { $regex: query, $options: "i" } },
            { description: { $regex: query, $options: "i" } },
          ],
        },
      ],
    };
  }
  const sortStage = {};
  if (sortBy && sortType) {
    sortStage["$sort"] = {
      createdAt: -1,
    };
  }
  const videos = await Video.aggregate([
    matchStage,
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $project: {
              fullname: 1,
              username: 1,
              avatar: 1,
            },
          },
        ],
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    sortStage,
    {
      $skip: (page - 1) * limit,
    },
    {
      $addFields: {
        owner: {
          $first: "$owner",
        },
        likes: {
          $size: "$likes",
        },
      },
    },
  ]);
  if (!videos) {
    throw new ApiError(500, "something went wrong while getting all videos.");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, videos, "All videos fetched successfully!!!"));
});

const publishVideo = asyncHandler(async (req, res) => {
  const { title, description, isPublished = true } = req.body;
  if (
    [title, description].some(
      (feild) => feild?.trim() === "" || feild.trim() === undefined
    )
  ) {
    throw new ApiError(400, `${feild} is required!!`);
  }
  let videoLocalPath;
  let thumbnailLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.videoFile) &&
    req.files.videoFile.length > 0
  ) {
    videoLocalPath = req.files.videoFile[0].path;
  }
  if (
    req.files &&
    Array.isArray(req.files.videoFile) &&
    req.files.thumbnail.length > 0
  ) {
    thumbnailLocalPath = req.files.thumbnail[0].path;
  }
  if (!videoLocalPath) {
    throw new ApiError(400, "Thumbnail file is required!!");
  }
  if (!thumbnailLocalPath) {
    throw new ApiError(400, "Thumbnail file is required!!");
  }
  const videoFile = await uploadOnCloudinary(videoLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);
  const user = await UserActivation.findById(req.user?._id).select(
    "-password -refreshToken"
  );
  if (!user) {
    throw new ApiError(404, "User not found!!");
  }
  const video = await Video.create({
    videoFile: videoFile.url,
    thumbnail: thumbnail.url,
    title: title,
    description: description,
    duration: videoFile.duration,
    isPublished: isPublished,
    owner: user._id,
  });
  return res
    .status(200)
    .json(new ApiResponse(200, video, "Video uploaded successfully!!"));
});


