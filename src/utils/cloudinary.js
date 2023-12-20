import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const uploadOnCloudinary = async (filePath) => {
  try {
    //console.log("1");
    if (!filePath) return null;
    // Upload file to cloudinary
    //console.log("2");
    const fileUrl = await cloudinary.uploader.upload(filePath, {
      resource_type: "auto",
    });
    //console.log("3");
    //console.log("File uploaded successfully", fileUrl.url);
    //File has been uploaded
    //console.log("4");
    fs.unlinkSync(filePath);
    return fileUrl.url;
  } catch (error) {
    //console.log("5");
    fs.unlinkSync(filePath); //remove the locally saved tempoary saved file as the upload operation falied
  }
};

export { uploadOnCloudinary };

// cloudinary.v2.uploader.upload(
//   "https://upload.wikimedia.org/wikipedia/commons/a/ae/Olympic_flag.jpg",
//   { public_id: "olympic_flag" },
//   function (error, result) {
//     console.log(result);
//   }
// );
