import { message } from "antd";
import api from "../index";
import aiApi from "../aiapi.js";
import { decryptData } from "../../utils/encrypt.js";

export const login = async (credentials) => {
  console.log("login credentials:", credentials);
  const response = await api.post("/user/loginbypassword", credentials);
  console.log("login response:", response);
  if (response.status === 200 && response.data && response.data.code === 200) {
    const encryptedUserData = response.data.data; // 获取包含加密字段的对象

    // 解密每个需要的字段
    const decryptedUser = {
      id: encryptedUserData.id, // ID 可能是明文，直接取
      name: encryptedUserData.name
        ? decryptData(encryptedUserData.name, "1234567890123456")
        : null,
      birth: encryptedUserData.birth
        ? decryptData(encryptedUserData.birth, "1234567890123456")
        : null,
      gender: encryptedUserData.gender
        ? decryptData(encryptedUserData.gender, "1234567890123456")
        : null,
      idCard: encryptedUserData.idCard
        ? decryptData(encryptedUserData.idCard, "1234567890123456")
        : null,
      nativePlace: encryptedUserData.nativePlace
        ? decryptData(encryptedUserData.nativePlace, "1234567890123456")
        : null,
      phone: encryptedUserData.phone
        ? decryptData(encryptedUserData.phone, "1234567890123456")
        : null,
      // 其他字段如果需要解密，也按此模式添加
      // address: encryptedUserData.address ? decryptData(encryptedUserData.address, "1234567890123456") : null,
      // career: encryptedUserData.career ? decryptData(encryptedUserData.career, "1234567890123456") : null,
      // ...
    };

    console.log("解密后的用户信息:", decryptedUser);
    return decryptedUser; // 返回解密后的用户对象
  } else {
    // 处理后端返回的错误或不成功的状态
    console.error("后端登录失败响应:", response.data.msg || "未知错误");
    throw new Error(response.data.msg || "登录失败");
  }
};

export const register = async (userData) => {
  console.log("register userData:", userData);
  const response = await api.post("/user/userRegister", userData);
  console.log("register response:", response);
  if (response.status === 200 && response.data && response.data.code === 200) {
    const encryptedUserData = response.data.data; // 获取包含加密字段的对象

    // 解密每个需要的字段
    const decryptedUser = {
      id: encryptedUserData.id, // ID 可能是明文，直接取
      name: encryptedUserData.name
        ? decryptData(encryptedUserData.name, "1234567890123456")
        : null,
      birth: encryptedUserData.birth
        ? decryptData(encryptedUserData.birth, "1234567890123456")
        : null,
      gender: encryptedUserData.gender
        ? decryptData(encryptedUserData.gender, "1234567890123456")
        : null,
      idCard: encryptedUserData.idCard
        ? decryptData(encryptedUserData.idCard, "1234567890123456")
        : null,
      nativePlace: encryptedUserData.nativePlace
        ? decryptData(encryptedUserData.nativePlace, "1234567890123456")
        : null,
      phone: encryptedUserData.phone
        ? decryptData(encryptedUserData.phone, "1234567890123456")
        : null,
      // 其他字段如果需要解密，也按此模式添加
      // address: encryptedUserData.address ? decryptData(encryptedUserData.address, "1234567890123456") : null,
      // career: encryptedUserData.career ? decryptData(encryptedUserData.career, "1234567890123456") : null,
      // ...
    };

    console.log("解密后的用户信息:", decryptedUser);
    return decryptedUser; // 返回解密后的用户对象
  } else {
    // 处理后端返回的错误或不成功的状态
    console.error("后端登录失败响应:", response.data.msg || "未知错误");
    throw new Error(response.data.msg || "登录失败");
  }
};

export const changeUserData = async (userData) => {
  const response = await api.post("/user/updateInfomation", userData);
  return response.data;
};

export const getUserInfoById = async (id) => {
  const response = await api.get("/user/GetInformationById", {
    params: { id },
  });
  return response.data;
};

// export const logout = async () => {
//   try {
//     const response = await api.post("/logout");
//     return response.data;
//   } catch (error) {
//     console.error("Logout failed", error);
//     throw error;
//   }
// };

//人脸
export const faceLogin = async (imageData) => {
  console.log("人脸登录的图片数据：", imageData);
  const response = await aiApi.post("", imageData, {
    headers: {
      "Content-Type": "application/json",
    },
  });
  console.log("人脸登录响应：", response);
  return response.data;
};

export const faceCollect = async (imageData) => {
  console.log("人脸采集的图片数据：", imageData);
  const response = await aiApi.post("", imageData, {
    headers: {
      "Content-Type": "application/json",
    },
  });
  console.log("人脸登录响应：", response);
  //   {
  //     "data": "",
  //     "status": 200,
  //     "statusText": "OK",
  //     "headers": {
  //         "content-type": "application/json"
  //     },
  //     "config": {
  //         "transitional": {
  //             "silentJSONParsing": true,
  //             "forcedJSONParsing": true,
  //             "clarifyTimeoutError": false
  //         },
  //         "adapter": [
  //             "xhr",
  //             "http",
  //             "fetch"
  //         ],
  //         "transformRequest": [
  //             null
  //         ],
  //         "transformResponse": [
  //             null
  //         ],
  //         "timeout": 50000,
  //         "xsrfCookieName": "XSRF-TOKEN",
  //         "xsrfHeaderName": "X-XSRF-TOKEN",
  //         "maxContentLength": -1,
  //         "maxBodyLength": -1,
  //         "env": {},
  //         "headers": {
  //             "Accept": "application/json, text/plain, */*",
  //             "Content-Type": "multipart/form-data"
  //         },
  //         "baseURL": "http://192.168.1.230:10925",
  //         "method": "post",
  //         "url": "",
  //         "data": {},
  //         "allowAbsoluteUrls": true
  //     },
  //     "request": {}
  // }
  return response.data;

  // await new Promise((resolve) => setTimeout(resolve, 500));
  // console.log("模拟接收到 FormData，对应的 Blob 是：", imageData.get("image"));

  // return {
  //   code: 200,
  //   msg: "识别成功",
  // };
};
