import React from "react";
import { Navigate } from "react-router-dom";
import { useSelector } from "react-redux"; // 或其他全局状态方式
import { message } from "antd";

const ManagerRouter = ({ children }) => {
  const user = localStorage.getItem("user");
  console.log("ManagerRouter user:", user);
  return children;
  if (user === null) {
    console.log("用户未登录");
    message.error("请先登录");
    return <Navigate to="/" replace />;
  }

};

export default ManagerRouter;
