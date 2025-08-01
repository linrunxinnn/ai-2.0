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
  UserOutlined,
  LockOutlined,
  SmileOutlined,
  MailOutlined,
  PhoneOutlined,
} from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
const { Text } = Typography;
import { getUserById, loginUser } from "../../store/slice/userSlice.js";
import { useDispatch } from "react-redux";
import { faceLogin } from "../../api/userservice/user.js";
import { encryptData } from "../../utils/encrypt.js";
import { fileToBase64 } from "../../utils/func.js";
// Deleted:import { useSocket } from "../../hooks/useSocket.js";
import faceRecognitionSocketManager from "../../utils/websocketCapture.js"

const LoginForm = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [loginType, setLoginType] = useState("email");
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const captureIntervalRef = useRef(null); // 用于存储定时器引用
  const FACE_RECOGNITION_TIMEOUT = 10000; // 人脸识别登录10秒超时
  const [isFaceRecognitionActive, setIsFaceRecognitionActive] = useState(false);
  //账号登录
  const handleAccountLogin = async (values) => {
    setLoading(true);
    try {
      console.log("登录信息：", values);
      const result = await dispatch(
        loginUser({
          identity: encryptData(values.identity), // Make sure your encryption key is consistent here! "HHH" is too short.
          password: encryptData(values.password), // Use the full 16-byte key
        })
      ).unwrap();

      // --- Corrected Lines ---
      // 'result' itself is the decrypted user object from the Redux thunk
      console.log("登录成功", result); // Changed from result.payload to result
      message.success(`登录成功，欢迎 ${result.name}`); // Changed from result.data.name to result.name
      // --- End Corrected Lines ---

      navigate("/Home");
    } catch (error) {
      message.error("登录失败");
      console.error("登录失败", error);
    } finally {
      setLoading(false);
    }
  };

  const toggleLoginType = () => {
    form.resetFields(); // 切换时清空字段
    setLoginType((prev) => (prev === "email" ? "phone" : "email"));
  };
  // 初始化摄像头
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // 将获取到的媒体流保存在 streamRef.current 中
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;// 播放视频
        await videoRef.current.play();// play() 是异步操作（可能需要等待用户授权、硬件准备等）
      }
    } catch (error) {
      message.error("无法访问摄像头");
    }
  };

  //关闭摄像头
  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
  };

  // 拍照并返回 Blob 图像数据
  const takePhotoBlob = () => {
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    // 绘制视频帧
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, "image/jpeg");
      // 将图片转换为blob，指定图片格式为jpeg
    });
  };

  // 发送照片的函数
  const sendPhotoViaSocket = async () => {
    try {
      const blob = await takePhotoBlob();
      // Deleted:if (isConnected && socket) {
      if (faceRecognitionSocketManager.getStatus()) {
        // 发送照片数据
        // Deleted:socket.emit("face_capture", {
        faceRecognitionSocketManager.send({
          type: "face_predict",
          image: blob,
        });
      }
    } catch (error) {
      console.error("发送照片失败:", error);
      message.error("发送照片失败");
    }
  };
  // 处理服务器响应的函数
  async function handleFaceCaptureResponse(response) {
    console.log("收到服务器响应:", response);
    if (response.message === "success") {
      try {
        // 清除所有定时器
        if (captureIntervalRef.current) {
          clearInterval(captureIntervalRef.current);
          captureIntervalRef.current = null;
        }

        message.success("人脸识别成功");
        //关闭摄像头
        stopCamera();
        setIsFaceRecognitionActive(false);

        // 根据data里面的id去获取用户信息
        const result = await dispatch(
          getUserById(response.user_id)
        ).unwrap();

        console.log("获取用户信息成功", result);
        message.success(`登录成功，欢迎 ${result.name}`);

        // 登录成功后跳转到主页
        navigate("/Home");
      } catch (error) {
        console.error("获取用户信息失败:", error);
        message.error("获取用户信息失败");
        // 关闭摄像头
        stopCamera();
        setIsFaceRecognitionActive(false);
      }
    } else if (response.message === "fail") {
      // 清除所有定时器
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
        captureIntervalRef.current = null;
      }

      message.error("人脸识别失败");
      //关闭摄像头
      stopCamera();
      setIsFaceRecognitionActive(false);
    } else {
      // 继续识别
      message.error("人脸识别中: 继续识别");
    }
  }

  // 组件卸载时的清理
  useEffect(() => {
    // 清理函数 - 组件卸载时执行
    return () => {
      // 清除所有定时器
      if (captureIntervalRef.current) {
        // 清除超时定时器
        if (captureIntervalRef.current.timeoutId) {
          clearTimeout(captureIntervalRef.current.timeoutId);
        }
        // 清除拍照定时器
        if (captureIntervalRef.current.intervalId) {
          clearInterval(captureIntervalRef.current.intervalId);
        }
        captureIntervalRef.current = null;
      }
      // 关闭摄像头
      stopCamera();
    };
  }, []);

  // 在 useEffect 中设置事件监听
  useEffect(() => {
    // 初始化WebSocket连接
    const initSocket = async () => {
      try {
        await faceRecognitionSocketManager.init();
      } catch (error) {
        console.error("WebSocket初始化失败:", error);
        message.error("无法连接到人脸识别服务");
      }
    };

    initSocket();

    // 监听服务器对人脸捕捉的响应
    const handleServerResponse = (response) => {
      handleFaceCaptureResponse(response.data);
    };

    // 设置回调
    faceRecognitionSocketManager.setCallbacks({
      onFaceLoginResponse: handleServerResponse,
      onError: (error) => {
        console.error("WebSocket错误:", error);
        message.error("人脸识别服务发生错误");
      }
    });

    // 清理函数
    return () => {
      // Deleted:socket.off("face_capture_response", handleFaceCaptureResponse);
      faceRecognitionSocketManager.disconnect();
    };
  }, []);


  //点击识别人脸登录按钮
  const handleFaceLogin = async () => {
    if (isFaceRecognitionActive || loading) {
      return;
    }

    setLoading(true);
    setIsFaceRecognitionActive(true); // 设置为人脸识别进行中

    try {
      await startCamera();

      // 确保视频尺寸准备好
      if (
        !videoRef.current ||
        videoRef.current.videoWidth === 0 ||
        videoRef.current.videoHeight === 0
      ) {
        throw new Error("摄像头视频未就绪");
      }

      // 开始定时捕捉照片并发送
      const intervalId = setInterval(sendPhotoViaSocket, 1000);

      // 存储定时器引用
      captureIntervalRef.current = intervalId;
    } catch (error) {
      message.error("摄像头初始化失败：" + error.message);
      console.log("摄像头初始化失败：", error);
      setLoading(false);
      setIsFaceRecognitionActive(false); // 出错时也要重置状态
      return;
    }
    setLoading(false);
  };

  // 添加 useEffect 来处理组件卸载时的清理
  useEffect(() => {
    // 清理函数 - 组件卸载时执行
    return () => {
      // 清除所有定时器
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
        captureIntervalRef.current = null;
      }
      // 关闭摄像头
      stopCamera();
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
            message="请确保保持人脸位于摄像头前，且光线充足"
            type="warning"
            style={{ width: "100%" }}
          />
          {/* 实时展示摄像头的内容 */}
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
                display: 'block'
              }}
              autoPlay
              muted
            />
          </div>
          <Button
            type="primary"
            icon={<SmileOutlined />}
            block
            onClick={handleFaceLogin}
            loading={loading}
          >
            识别人脸并登录
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="flex justify-center items-center h-screen bg-gray-100">
      <Card style={{ width: 400, border: "none" }}>
        <Tabs defaultActiveKey="account" items={tabItems} />
      </Card>
    </div>
  );
};

export default LoginForm;