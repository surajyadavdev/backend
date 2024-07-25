import {asyncHandler}from "../utils/asyncHandler.js";
import {ApiError} from "../utils/ApiError.js"
import {User} from "../models/user.models.js"
import {uploadOnCloudinary} from "../utils/cloudinary.js"
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken"
import { stringify } from 'flatted'; 
import { response } from "express";

const generateAccessAndRefressTokens = async(userId)=>{
    try {
        const user = await User.findById(userId)
        // console.log(user);
        const accessToken = user.generateAccessToken()
        const refreshToken  = user.generateRefreshToken()
        // console.log(refreshToken);

        user.refreshToken = refreshToken
        user.save({validateBeforeSave:false})

        return{accessToken,refreshToken}
    } catch (error) {
        throw new ApiError(500,"Something went wrong while generating refresh and access token")
    }
}

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

    const {fullName,email,username,password}=req.body
    console.log("email:",email);
    if (
        [fullName,email,username,password].some((field) =>
        field?.trim() === "")
    ) {
        throw new ApiError(400,"All fields are required")
    }

    const existedUser  = await User.findOne({
        $or:[{username },{ email }]
    })

    if(existedUser){
        throw new ApiError(409,"User with email or username alredy exists ")
    }
    // console.log(req.files);
    const avatarLocalPath = req.files?.avatar[0]?.path;
    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    let coverImageLocalPath;
    if(req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length>0){
        coverImageLocalPath = req.files.coverImage[0].path
    }
    
    if (!avatarLocalPath){
        throw new ApiError(400,"Avatar file is required")
    }

    const avatar = await uploadOnCloudinary(avatarLocalPath)
    const coverImage  = await uploadOnCloudinary(coverImageLocalPath)

    if(!avatar){ 
        throw new ApiError(400,"Avatar file is required")
    }
    const user = await User.create({
        fullName,
        avatar:avatar.url,
        coverImage:coverImage?.url || "",
        email,
        password,
        username:username.toLowerCase()
    })

    const createdUser =User.findById(user._id).select(
        "-password -refreshToken "
    ).lean();
    if(!createdUser){
       throw new ApiError(500,"Something went wrong while registering the user ") 
    }
    // return res.status(201).json(
    //     new ApiResponse(200,createdUser, "user registered Successfully")
    // )
   
    console.log(createdUser);
    // Serialize the createdUser object safely
    const safeCreatedUser = JSON.parse(stringify(createdUser))
    console.log(safeCreatedUser);


    return res.status(201).json(new ApiResponse(200, safeCreatedUser, "User registered successfully"));
    

});
const loginUser = asyncHandler(async(req,res)=>{
    // req body  ->data
    // username or email
    // find the user in db
    // password check
    // access and refresh token generate (to send user)
    // send token in cookies 
    // send respons you loged in
    const {email,username,password} = req.body
    // if(!username && !email){
    //     throw new ApiError(400,"username  and email is required")
    // } 
    if(!(username || email)){
        throw new ApiError(400,"username  or email is required")
    } 
    const user = await User.findOne({
        $or:[{username},{email}]
    })
    if(!user){
        throw new ApiError(404,"User does not exist")
    }
    // bcrypt hai to await lgana pdega  yha pr diff hai User ye mongodb ka hai lekin yha pr apna user ye lena padega
    const isPasswordValid = await user.isPasswordCorrect(password)
    if(!isPasswordValid){
        throw new ApiError(401,"Invalid user credentials")
    }

    const {accessToken,refreshToken} = await generateAccessAndRefressTokens(user._id)
    // sending in cookies
    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")
    // only modified by server
    const options = {
        httpOnly:true,
        secure:true
    } 
    return res
    .status(200)
    .cookie("accessToken",accessToken,options)
    .cookie("refreshToken",refreshToken, options)
    .json(
        new ApiResponse(
            200,
            {
                user:loggedInUser,accessToken,refreshToken
            },
            "User logged In Successfully"
        )
    )
})
const logoutUser = asyncHandler(async(req,res)=>{
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set:{
                refreshToken:undefined
            }
        },
        {
            new:true
        }

    )

    const options = {
        httpOnly:true,
        secure:true
    } 
    return res
    .status(200)
    .clearCookie("accessToken",options)
    .clearCookie("refreshToken",options)
    .json(new ApiResponse(200,{},"user logged Out"))
})
const refreshAccessToken  = asyncHandler(async(req,res) =>{
   try {
     const incommingRefreshToken = req.cookies.refreshToken || req.body.refreshToken
     if(!incommingRefreshToken){
         throw new ApiError(401,"unauthorized request")
     }
     const decodedToken = jwt.verify(
         incommingRefreshToken,process.env.AcCESS_TOKEN_SECRET
     )
     const user = await User.findById(decodedToken?._id)
     if(!user){
 
         throw new ApiError(401,"Invalid refresh token")
     }
     if(incommingRefreshToken!==user?.refreshToken){
             throw new ApiError(401,"Refresh token is expired or used")
     }
     const options = {
         httpOnly:true,
         secret:true
     }
 
     const{accessToken,newRefreshToken} = await generateAccessAndRefressTokens(user._id)
     return res
     .status(200)
     .cookie("accessToken",accessToken,options)
     .cookie("refreshToken",newRefreshToken,options)
     .json(
         new ApiResponse(
             200,
             {accessToken,refreshToken:newRefreshToken},
             "Access token refreshed"
         )
     )
   } catch (error) {
        throw new ApiError(401,error?.message || "Invalid refresh token")
   }

})
const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword,newPassword} = req.body
    const user = await User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)
    if(!isPasswordCorrect){
        throw new ApiError(400,"Invalid old password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave:false})

    return res
    .status(200)
    .json(new ApiResponse(200,{},"Password change successfully"))
})

const getCurrentUser  = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(200,req.user,"current user fetched successfully")
})
const updateAccountDetails = asyncHandler(async(req,res)=>{
    const {fullName,email} = req.body
    if(!fullName || !email){
        throw new ApiError(400,"All fields are required")
    }
    const user = User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                fullName,
                email:email
            },
        },
        {new:true}

    ).select("-password")
    return res
    .status(200)
    .json(new ApiResponse(200,user,"Account details updated successfully"))
})

const updateUserAvatar = asyncHandler(async(req,res)=>{
    const avatarLocalPath = req.file?.path
    if(!avatarLocalPath){
        throw new ApiError(400,"Avatar file is missing")
    }
    const avatar = await uploadOnCloudinary(avatarLocalPath)
    if(!avater.url){
        throw new ApiError(400,"Error while uploading on avatar")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                avatar:avatar.url
            }
        },
        {new:true}
    ).select("-password")

    .status(200)
    .json(
        new ApiResponse(200,user,"avatar image updated successfully")
    )
   
   
})

const updateUserCoverImage = asyncHandler(async(req,res)=>{
    const coverImageLocalPath = req.file?.path
    if(!coverImageLocalPath){
        throw new ApiError(400,"Cover Image file is missing")
    }
    const coverImage = await uploadOnCloudinary(coverImageLocalPath)
    if(!coverImage.url){
        throw new ApiError(400,"Error while uploading on cover image")
    }
    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set:{
                coverImage:coverImage.url
            }
        },
        {new:true}
    ).select("-password")

    return res
    .status(200)
    .json(
        new ApiResponse(200,user,"Cover image updated successfully")
    )
   
})
export {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changeCurrentPassword,
    getCurrentUser,
    updateAccountDetails,
    updateUserAvatar,
    updateUserCoverImage
    
};