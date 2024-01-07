import { asyncHandler } from "../utils/asyncHandler.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefereshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);

    const accessToken = jwt.sign(
      {
        _id: user._id,
        email: user.email,
        username: user.username,
        fullname: user.fullname,
      },
      process.env.ACCESS_TOKEN_SECRET,
      { expiresIn: process.env.ACCESS_TOKEN_EXPIRY }
    );
    //console.log(accessToken);
    const refreshToken = jwt.sign(
      {
        _id: user._id,
      },
      process.env.REFRESH_TOKEN_SECRET,
      { expiresIn: process.env.REFRESH_TOKEN_EXPIRY }
    );
    //console.log(refreshToken);
    user.refreshToken = refreshToken;

    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating referesh and access token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  const { username, fullname, email, password } = req.body;
  if (fullname === "") {
    throw new ApiError(400, "Fullname is required");
  }
  if (email === "") {
    throw new ApiError(400, "Email is required");
  }
  if (password === "") {
    throw new ApiError(400, "Password id required");
  }
  if (username === "") {
    throw new ApiError(400, "Username is required");
  }
  const existing = await User.findOne({
    $or: [{ username }, { email }],
  });
  if (existing) {
    throw new ApiError(409, "Username or emial already exists");
  }
  const avatarLocalPath = req.files?.avatar[0]?.path;
  var coverImageLocalPath;
  if (req.files.coverImage) {
    coverImageLocalPath = req.files?.coverImage[0]?.path;
  }
  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }
  const avatar = await uploadOnCloudinary(avatarLocalPath);
  //console.log("I");
  //console.log(avatarLocalPath, " ", avatarPath);
  const coverImage = await uploadOnCloudinary(coverImageLocalPath);
  // console.log(coverImageLocalPath, " ", coverImagePath);
  if (!avatar) {
    throw new ApiError(400, "Something went wrong");
  }
  const userInstance = await User.create({
    fullname,
    avatar,
    coverImage,
    username: username.toLowerCase(),
    email,
    password,
  });
  const createdUser = await User.findById(userInstance._id).select(
    "-password -refreshToken"
  );
  if (!createdUser) {
    throw new ApiError(500, "Something went wrong");
  }
  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "Registration Successfull"));
});

const loginUser = asyncHandler(async (req, res) => {
  // req body -> data
  // username or email
  //find the user
  //password check
  //access and referesh token
  //send cookie

  const { username, password } = req.body;
  //console.log(email);

  if (!username) {
    throw new ApiError(400, "username is required");
  }

  // Here is an alternative of above code based on logic discussed in video:
  // if (!(username || email)) {
  //     throw new ApiError(400, "username or email is required")

  // }

  const user = await User.findOne({
    $or: [{ username }],
  });

  if (!user) {
    throw new ApiError(404, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);

  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid user credentials");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
    user._id
  );
  console.log(accessToken);

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    //secure: true,
  };

  return res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged In Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: 1,
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    //secure: true,
  };
  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "Logout Successfull!!"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const token = req.cookies.refreshToken || req.body.refreshToken;
  if (!token) {
    throw new ApiError(401, "Unauthrized Request!!");
  }
  try {
    const decodedToken = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);
    const user = await User.findById(decodedToken?._id);
    if (!user) {
      throw new ApiError(401, "Invalid Refresh Token");
    }
    if (token !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }
    const options = {
      httpOnly: true,
      //secure: true,
    };
    const { accessToken, refreshToken } = await generateAccessAndRefereshTokens(
      user._id
    );
    return res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          {
            accessToken: accessToken,
            refreshToken: refreshToken,
          },
          "Access Token refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(401, error?.message || "Invalid Refresh Token!!");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;
  //console.log(oldPassword);
  //console.log(newPassword);
  const user = await User.findById(req.user?._id);
  const passwordCheck = await user.isPasswordCorrect(oldPassword);
  if (!passwordCheck) {
    throw new ApiError(400, "Invalid old password!!");
  }
  user.password = newPassword;
  await user.save({ validateBeforeSave: false });
  return res
    .status(200)
    .json(new ApiResponse(200, {}, "Password Changed Successfully!!!"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetch successfully!!"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullname, email } = req.body;
  if (!fullname || !email) {
    throw new ApiError(400, "All fields are required!!");
  }
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullname: fullname,
        email: email,
      },
    },
    {
      new: true,
    }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details updated successfully!!"));
});

const updateUserAvatar = asyncHandler(async (req, res) => {
  const newAvatarLocalPath = req.files?.avatar[0]?.path;
  //console.log(newAvatarLocalPath);
  if (!newAvatarLocalPath) {
    throw new ApiError(400, "Avatar is required");
  }
  const newAvatar = await uploadOnCloudinary(newAvatarLocalPath);
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        avatar: newAvatar,
      },
    },
    {
      new: true,
    }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Avatar updated successfully!!"));
});

const updateCoverImage = asyncHandler(async (req, res) => {
  const newCoverImageLocalPath = req.files?.coverImage[0]?.path;
  if (!newCoverImageLocalPath) {
    throw new ApiError(400, "Cover Image is Required!!");
  }
  const newCoverImage = await uploadOnCloudinary(newCoverImageLocalPath);
  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: newCoverImage,
      },
    },
    {
      new: true,
    }
  ).select("-password");
  return res
    .status(200)
    .json(new ApiResponse(200, user, "Cover Image is updated successfully!!"));
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;
  if (!username?.trim) {
    throw new ApiError(400, "Username is missing!!!");
  }
  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribed_to",
      },
    },
    {
      $addFields: {
        subscriberCount: {
          $size: "$subscriber",
        },
        channelsSubscribedToCount: {
          $size: "$subscribed_to",
        },
        isSubscribed: {
          $cond: {
            if: {
              $in: [req.user?._id, "$subscriber.subscriber"],
            },
            then: true,
            else: true,
          },
        },
      },
    },
    {
      $project: {
        fullname: 1,
        username: 1,
        subscriberCount: 1,
        channelsSubscribedToCount: 1,
        isSubscribed: 1,
        avatar: 1,
        coverImage: 1,
      },
    },
  ]);
  if (!channel?.length) {
    throw new ApiError(404, "Channel does not exist!!");
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched successfully!!!")
    );
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
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
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);
  return res
    .status(200)
    .status.json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        "Watch history fetched successfully!!"
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  updateUserAvatar,
  updateCoverImage,
  getUserChannelProfile,
  getWatchHistory,
};
