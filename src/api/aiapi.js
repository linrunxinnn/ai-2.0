import { message } from "antd";
import axios from "axios";

const aiApi = axios.create({
  baseURL: "http://192.168.1.230:10925",
  timeout: 50000,
  headers: {
    "Content-Type": "application/json",
  },
});

// 添加请求拦截器
aiApi.interceptors.request.use(
  function (config) {
    // 在发送请求之前做些什么
    const token = localStorage.getItem("token");
    if (token) {
      config.headers["Authorization"] = `Bearer ${token}`;
    }
    return config;
  },
  function (error) {
    // 对请求错误做些什么
    return Promise.reject(error);
  }
);
// 添加响应拦截器
aiApi.interceptors.response.use(
  function (response) {
    // 对响应数据做点什么
    //如果数据格式是加密的，可以在这里解密
    return response;
  },
  function (error) {
    // 对响应错误做点什么
    console.error("AI API 响应错误:", error);
    message.error("AI API 响应错误，请稍后重试");
    return Promise.reject(error);
  }
);

export default aiApi;
