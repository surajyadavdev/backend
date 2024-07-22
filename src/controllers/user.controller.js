 import {asyncHandler}from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.models.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
const registerUser = asyncHandler(async(req,res,)=>{    
    // get user details from frontend
    // validation -- not empty
    // check if user alredy exists   usename and email
    // check for images,check for avator
    // upload them to cloudinary, check avtart uploaded or not 
    // create user object -create entry in db
    // remove password and refresh token field from response  
    // check for user creation 
    // return res  

    const {fullNeme,email,username,password}=req.body
    console.log("email:",email);
    if (
        [fullNeme,email,username,password].some((field) =>
        field?.trim() === "")
    ) {
        throw new ApiError(400,"All fields are required")
    }

    const existedUser  = User.findOne({
        $or:[{username },{ email }]
    })

    if(existedUser){
        throw new ApiError(409,"User with email or username alredy exists ")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    const coverImageLocalPath = req.file?.coverImage[0]?.path;
    
    if (!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage  = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){ 
        throw new ApiError(400,"Avatar file is required")
    }
    const user = await User.create({
        fullNeme,
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        email,
        password,
        username:username.toLowerCase()
    })
    const createdUserUser =User.findById(user._id).select(
        "-password -refreshToken "
    )
    if(!createdUserUser){
       throw new ApiError(500,"Something went wrong while registering the user ") 
    }
    return res.status(201).json(
        new ApiResponse(200,createdUser, "user registered Successfully")
    )
   
    })

export {registerUser};