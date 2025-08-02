import React, { useEffect, useRef, useState } from "react";
import { Button, message, Alert } from "antd";
import { useSelector } from "react-redux";
import style from "./Collect.module.css";
import { useNavigate } from "react-router-dom";

const Collect = () => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const captureIntervalRef = useRef(null);
  const socketRef = useRef(null); // 添加socket引用
  const [collecting, setCollecting] = useState(false);
  const userId = useSelector((state) => state.user.id);
  const navigate = useNavigate();
  const [socketStatus, setSocketStatus] = useState("未连接"); // 添加连接状态

  // WebSocket服务器地址
  const WS_URL = "ws://localhost:444";

  // 跳转到这个页面时的初始化设置
  useEffect(() => {
    // 初始化WebSocket连接
    const initSocket = () => {
      try {
        // 关闭已有的连接
        if (socketRef.current) {
          socketRef.current.close();
        }

        setSocketStatus("连接中...");
        socketRef.current = new WebSocket(WS_URL);

        // 连接成功
        socketRef.current.onopen = () => {
          console.log("WebSocket连接已建立");
          setSocketStatus("已连接");
          message.success("人脸采集服务已连接");
        };

        // 接收消息
        socketRef.current.onmessage = (event) => {
          try {
            const response = JSON.parse(event.data);
            console.log("收到服务器响应:", response);
            handleServerResponseInternal(response);
          } catch (error) {
            console.error("解析服务器消息失败:", error);
            message.error("人脸采集服务响应异常");
          }
        };

        // 连接关闭
        socketRef.current.onclose = () => {
          console.log("WebSocket连接已关闭");
          setSocketStatus("已断开");
          if (collecting) {
            // 清除所有定时器
            if (captureIntervalRef.current) {
              if (captureIntervalRef.current.interval) {
                clearInterval(captureIntervalRef.current.interval);
              }
              if (captureIntervalRef.current.timeout) {
                clearTimeout(captureIntervalRef.current.timeout);
              }
              captureIntervalRef.current = null;
            }

            setCollecting(false);
            message.error("人脸采集服务连接已断开，采集已停止");
            message.error("人脸录入失败，请下次再录入");
            navigate("/home"); // 跳转到主页或其他页面
          }
        };

        // 连接错误
        socketRef.current.onerror = (error) => {
          console.error("WebSocket错误:", error);
          setSocketStatus("连接错误");
          message.error("人脸采集服务发生错误");
        };
      } catch (error) {
        console.error("WebSocket初始化失败:", error);
        message.error("无法连接到人脸采集服务");
      }
    };

    initSocket();

    // 打开摄像头
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          // 添加错误处理
          try {
            await videoRef.current.play();
          } catch (playError) {
            if (playError.name !== 'AbortError') {
              console.error('播放视频时出错:', playError);
              message.error("无法播放视频流");
            }
          }
        }
      } catch (error) {
        console.log(error);
        message.error("无法访问摄像头");
      }
    };
    startCamera();

    return () => {
      stopCamera();
      // 组件销毁的时候清除所有定时器
      if (captureIntervalRef.current) {
        if (captureIntervalRef.current.interval) {
          clearInterval(captureIntervalRef.current.interval);
        }
        if (captureIntervalRef.current.timeout) {
          clearTimeout(captureIntervalRef.current.timeout);
        }
      }
      // 关闭WebSocket连接
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

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
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        resolve(blob);
      }, "image/jpeg");
    });
  };

  //开始进行人脸收集
  const handleStart = () => {
    // 检查WebSocket连接状态
    if (!socketRef.current || socketRef.current.readyState !== WebSocket.OPEN) {
      message.error("人脸采集服务未连接");
      return;
    }

    setCollecting(true);

    // 第一个请求：只发送用户ID
    socketRef.current.send(JSON.stringify({
      type: "face_train",
      user_id: userId,
      hash: "",
    }));

    // 设置30秒超时定时器,超过30秒自动断开连接
    const timeoutId = setTimeout(() => {

      // 断开WebSocket连接
      if (socketRef.current) {
        socketRef.current.close();
      }

      setCollecting(false);
      message.error("人脸录入超时，请稍后再试");
      navigate("/Home"); // 跳转到主页或其他页面
    }, 30000); // 30秒超时

    // 将超时定时器存储在captureIntervalRef中
    captureIntervalRef.current = {
      interval: null,
      timeout: timeoutId
    };

    // 第二个请求：开始定时捕获并发送图片
    captureIntervalRef.current.interval = setInterval(async () => {
      try {
        const blob = await takePhotoBlob();
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          // 发送元数据
          socketRef.current.send(JSON.stringify({
            type: "face_train_image",
            user_id: userId
          }));
          // 发送图片数据
          socketRef.current.send(blob);
        }
      } catch (error) {
        console.error("发送照片失败:", error);
        message.error("发送照片失败");
      }
    }, 1000); // 每秒发送一次
  };

  //停止采集
  const handleServerResponseInternal = (response) => {
    // 只有当服务器返回成功时才停止采集
    if (response.message === "success") {
      // 销毁掉两个计时器
      if (captureIntervalRef.current) {
        if (captureIntervalRef.current.interval) {
          clearInterval(captureIntervalRef.current.interval);
        }
        if (captureIntervalRef.current.timeout) {
          clearTimeout(captureIntervalRef.current.timeout);
        }
        captureIntervalRef.current = null;
      }
      setCollecting(false);

      message.success("人脸采集完成");
      navigate("/home");
    } else {
      // 如果服务器返回失败，继续采集
      console.log("人脸采集失败，继续采集...");
      message.error("人脸采集失败，请调整角度重试");
    }
  };

  const handleStop = () => {
    // 清除所有定时器
    if (captureIntervalRef.current) {
      if (captureIntervalRef.current.interval) {
        clearInterval(captureIntervalRef.current.interval);
      }
      if (captureIntervalRef.current.timeout) {
        clearTimeout(captureIntervalRef.current.timeout);
      }
      captureIntervalRef.current = null;
    }
    setCollecting(false);
    message.info("已停止采集");
  };

  return (
    <div className={style.main}>
      <div className={style.container}>
        <video
          ref={videoRef}
          width="1200"
          height="768"
          style={{ border: "1px solid #ccc" }}
          autoPlay
          playsInline
          muted
        />
        <div>
          <Button
            type="primary"
            onClick={handleStart}
            disabled={collecting || socketStatus !== "已连接"}
            style={{ marginRight: 10 }}
          >
            {collecting ? "采集中..." : "开始采集"}
          </Button>
          {collecting && (
            <Button onClick={handleStop}>
              停止采集
            </Button>
          )}
        </div>
        <Alert message="请缓慢转动头部，让系统采集更多角度" type="info" />
      </div>
    </div>
  );
};

export default Collect;