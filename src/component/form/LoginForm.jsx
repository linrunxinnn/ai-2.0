import React, { useState, useRef, useEffect } from "react";
import {
  Card,
  Tabs,
  Form,
  Input,
  Button,
  message,
  Typography,
  Alert,
} from "antd";
import {
  LockOutlined,
  SmileOutlined,
  MailOutlined,
  PhoneOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
const { Text } = Typography;
import { getUserById, loginUser } from "../../store/slice/userSlice.js";
import { useDispatch } from "react-redux";
import { encryptData } from "../../utils/encrypt.js";


const LoginForm = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [loginType, setLoginType] = useState("email");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const captureIntervalRef = useRef(null); // 定时器引用
  const socketRef = useRef(null); // WebSocket实例引用
  const [isFaceRecognitionActive, setIsFaceRecognitionActive] = useState(false);
  const [socketStatus, setSocketStatus] = useState("未连接"); // WebSocket连接状态
  //WebSocket服务器地址(根据实际修改)
  const WS_URL = "ws://192.168.58.1:33042/face_predict";

  const handleAccountLogin = async (values) => {
    setLoading(true);
    try {
      console.log("登录信息：", values);
      const result = await dispatch(
        loginUser({
          identity: encryptData(values.identity),
          password: encryptData(values.password),
        })
      ).unwrap();

      console.log("登录成功", result);
      message.success(`登录成功，欢迎 ${result.name}`);
      navigate("/Home");
    } catch (error) {
      message.error("登录失败：" + (error.message || "账号或密码错误"));
      console.error("登录失败", error);
    } finally {
      setLoading(false);
    }
  };

  // 切换登录类型
  const toggleLoginType = () => {
    form.resetFields();
    setLoginType((prev) => (prev === "email" ? "phone" : "email"));
  };

  // 初始化摄像头
  const startCamera = async () => {
    try {
      // 先停止可能存在的旧流
      stopCamera();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 } // 指定分辨率，平衡性能和清晰度
      });
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        console.log("摄像头初始化成功");
      }
      return true;
    } catch (error) {
      message.error("无法访问摄像头：" + error.message);
      console.error("摄像头访问失败:", error);
      return false;
    }
  };

  // 关闭摄像头
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // 拍照并返回Blob
  const takePhotoBlob = () => {
    return new Promise((resolve) => {
      const video = videoRef.current;
      if (!video) {
        resolve(null);
        return;
      }

      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        resolve(blob);
      }, "image/jpeg", 0.7); // 压缩质量0.7，减少数据量
    });
  };

  // 初始化WebSocket连接
  const initWebSocket = () => {
    // 关闭已有连接
    if (socketRef.current) {
      socketRef.current.close();
    }

    setSocketStatus("连接中...");
    socketRef.current = new WebSocket(WS_URL);

    // 连接成功
    socketRef.current.onopen = () => {
      console.log("WebSocket连接已建立");
      setSocketStatus("已连接");
      message.success("人脸识别服务已连接");
    };

    // 接收消息
    socketRef.current.onmessage = (event) => {
      try {
        const response = JSON.parse(event.data);
        console.log("收到服务器响应:", response);
        handleFaceCaptureResponse(response);
      } catch (error) {
        console.error("解析服务器消息失败:", error);
        message.error("人脸识别服务响应异常");
      }
    };

    // 连接关闭
    socketRef.current.onclose = (event) => {
      console.log(`WebSocket连接关闭，代码: ${event.code}, 原因: ${event.reason}`);
      setSocketStatus("已断开");

      // 如果是识别过程中断开，提示用户
      if (isFaceRecognitionActive) {
        message.warning("人脸识别服务连接断开");
      }
    };

    // 连接错误
    socketRef.current.onerror = (error) => {
      console.error("WebSocket错误:", error);
      setSocketStatus("连接错误");
      message.error("人脸识别服务连接出错");

      // 清除定时器
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
        captureIntervalRef.current = null;
      }

      // 如果正在进行人脸识别，停止它
      if (isFaceRecognitionActive) {
        stopCamera();
        setIsFaceRecognitionActive(false);
        setLoading(false);
      }
    };
  };

  // 发送照片到服务器
  const sendPhotoViaSocket = async () => {
    // 检查连接状态
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      console.log("WebSocket未连接，无法发送照片");
      return;
    }

    try {
      const blob = await takePhotoBlob();
      if (!blob) {
        console.log("拍照失败，无法发送");
        return;
      }

      // 直接发送二进制图片数据
      socketRef.current.send(blob);
    } catch (error) {
      console.error("发送照片失败:", error);
      message.error("发送照片失败");
    }
  };


  // 处理服务器人脸识别响应
  const handleFaceCaptureResponse = async (response) => {
    if (response.message === "success") {
      try {
        // 清除定时器
        clearInterval(captureIntervalRef.current);
        captureIntervalRef.current = null;

        message.success("人脸识别成功，正在登录...");
        stopCamera();
        setIsFaceRecognitionActive(false);

        // 获取用户信息并跳转
        const result = await dispatch(getUserById(response.user_id)).unwrap();
        message.success(`登录成功，欢迎 ${result.name}`);
        navigate("/Home");
      } catch (error) {
        console.error("获取用户信息失败:", error);
        message.error("登录失败：获取用户信息失败");
        stopCamera();
        setIsFaceRecognitionActive(false);
        setLoading(false);
      }
    } else if (response.message === "fail") {
      clearInterval(captureIntervalRef.current);
      captureIntervalRef.current = null;
      message.error("人脸识别失败：" + (response.reason || "未匹配到用户"));
      stopCamera();
      setIsFaceRecognitionActive(false);
      setLoading(false); // 添加这一行
    } else {
      // 继续识别
      message.info("请保持人脸在镜头前...");
    }
  };

  // 开始人脸识别登录
  const handleFaceLogin = async () => {
    if (isFaceRecognitionActive || loading) return;

    setLoading(true);
    setIsFaceRecognitionActive(true);

    try {
      // 1. 检查WebSocket连接
      if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
        message.info("正在连接人脸识别服务...");
        initWebSocket();
        // 等待连接成功（最多等5秒）
        let attempts = 0;
        const maxAttempts = 15; // 最多尝试15次（5秒）
        await new Promise((resolve, reject) => {
          const checkInterval = setInterval(() => {
            attempts++;
            if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
              clearInterval(checkInterval);
              resolve(true);
            } else if (attempts >= maxAttempts) {
              clearInterval(checkInterval);
              reject(new Error("连接人脸识别服务超时"));
            }
          }, 300);
        });
      }

      // 2. 初始化摄像头
      const cameraReady = await startCamera();
      if (!cameraReady) {
        throw new Error("摄像头初始化失败");
      }

      // 3. 开始定时发送照片（每1秒一次）
      captureIntervalRef.current = setInterval(sendPhotoViaSocket, 1000);

    } catch (error) {
      console.error("人脸识别启动失败:", error);
      message.error("启动失败：" + error.message);
      setIsFaceRecognitionActive(false);
    } finally {
      setLoading(false);
    }
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      // 清除定时器
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
      // 关闭摄像头
      stopCamera();
      // 关闭WebSocket连接
      if (socketRef.current) {
        socketRef.current.close(1000, "组件卸载");
      }
    };
  }, []);

  const tabItems = [
    {
      key: "account",
      label: "账号密码登录",
      children: (
        <Form form={form} onFinish={handleAccountLogin} autoComplete="off">
          {loginType === "email" ? (
            <Form.Item
              name="identity"
              rules={[
                { required: true, message: "请输入邮箱" },
                { type: "email", message: "请输入有效的邮箱" },
              ]}
            >
              <Input prefix={<MailOutlined />} placeholder="邮箱" />
            </Form.Item>
          ) : (
            <Form.Item
              name="identity"
              rules={[
                { required: true, message: "请输入手机号" },
                { pattern: /^1[3-9]\d{9}$/, message: "请输入有效的手机号" },
              ]}
            >
              <Input prefix={<PhoneOutlined />} placeholder="手机号" />
            </Form.Item>
          )}

          <Form.Item
            name="password"
            rules={[{ required: true, message: "请输入密码" }]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="密码"
              autoComplete="current-password"
            />
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit" block loading={loading}>
              登录
            </Button>
          </Form.Item>

          <Form.Item style={{ textAlign: "center", marginBottom: 0 }}>
            <Text
              type="secondary"
              style={{ cursor: "pointer" }}
              onClick={toggleLoginType}
            >
              {loginType === "email" ? "使用手机号登录" : "使用邮箱登录"}
            </Text>
          </Form.Item>
        </Form>
      ),
    },
    {
      key: "face",
      label: "人脸识别登录",
      children: (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
            width: "100%",
          }}
        >
          <Alert
            message={`人脸识别服务状态：${socketStatus}`}
            type={socketStatus === "已连接" ? "success" :
              socketStatus === "连接中..." ? "info" : "warning"}
            style={{ width: "100%" }}
          />
          <Alert
            message="请确保保持人脸位于摄像头前，光线充足"
            type="warning"
            style={{ width: "100%" }}
          />

          <div style={{
            width: '100%',
            display: 'flex',
            justifyContent: 'center',
            marginBottom: '10px'
          }}>
            <video
              ref={videoRef}
              style={{
                width: '320px',
                height: '240px',
                borderRadius: '8px',
                border: '1px solid #d9d9d9',
                display: 'block',
                backgroundColor: '#000'
              }}
              autoPlay
              muted
              playsInline // 解决移动端播放问题
            />
          </div>

          <Button
            type="primary"
            icon={<SmileOutlined />}
            block
            onClick={handleFaceLogin}
            loading={loading || socketStatus === "连接中..."}
            disabled={isFaceRecognitionActive}
          >
            {isFaceRecognitionActive ? "识别中..." : "识别人脸并登录"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <Card style={{ width: 400, border: "none", boxShadow: "0 2px 10px rgba(0,0,0,0.1)" }}>
        <Tabs defaultActiveKey="account" items={tabItems} />
      </Card>
    </div>
  );
};

export default LoginForm;