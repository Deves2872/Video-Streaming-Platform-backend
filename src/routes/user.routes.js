import { Router } from "express";
import {
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
} from "../controllers/user.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

const router = Router();

router.route("/register").post(
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  registerUser
);

router.route("/login").post(loginUser);

router.route("/logout").post(verifyJWT, logoutUser);

router.route("/refresh-token").post(refreshAccessToken);

router.route("/change-password").post(verifyJWT, changeCurrentPassword);

router.route("/get-user").get(verifyJWT, getCurrentUser);

router.route("/update-details").patch(verifyJWT, updateAccountDetails);

router.route("/change-avatar").patch(
  verifyJWT,
  upload.fields([
    {
      name: "avatar",
      maxCount: 1,
    },
  ]),
  updateUserAvatar
);

router.route("/change-coverimage").patch(
  verifyJWT,
  upload.fields([
    {
      name: "coverImage",
      maxCount: 1,
    },
  ]),
  updateCoverImage
);

router.route("/:username").get(verifyJWT, getUserChannelProfile);

router.route("/history").get(verifyJWT, getWatchHistory);

export default router;
