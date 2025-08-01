import axios from "axios";

const api = axios.create({
  baseURL: "http://192.168.1.108:8080", // 设置基础URL
  timeout: 10000, // 设置请求超时时间
  headers: {
    "Content-Type": "application/json",
    // Authorization: `Bearer ${localStorage.getItem("token") || ""}`, // 从localStorage获取token
  },
});

// 添加请求拦截器
api.interceptors.request.use(
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
api.interceptors.response.use(
  function (response) {
    // 对响应数据做点什么
    //如果数据格式是加密的，可以在这里解密
    return response;
  },
  function (error) {
    // 对响应错误做点什么

    return Promise.reject(error);
  }
);

export default api;
