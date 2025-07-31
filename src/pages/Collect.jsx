import React, { useEffect, useRef, useState } from "react";
import { Button, message, Alert } from "antd";
import { useSelector } from "react-redux";
import style from "./Collect.module.css";
import { useNavigate } from "react-router-dom";
import { useSocket } from "../hooks/useSocket.js";
import { fileToBase64 } from "../utils/func.js";
const Collect = () => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const captureIntervalRef = useRef(null);
  const [collecting, setCollecting] = useState(false);
  const userId = useSelector((state) => state.user.id);
  const navigate = useNavigate();
  const { socket, isConnected } = useSocket();

  useEffect(() => {
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
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
    };
  }, []);

  // Socket事件监听
  useEffect(() => {
    if (socket) {
      // 监听连接断开
      const handleDisconnect = () => {
        if (collecting) {
          handleStop();
          message.error("Socket 连接已断开，采集已停止");
        }
      };

      // 监听服务器响应
      const handleServerResponse = (response) => {
        handleServerResponseInternal(response);
      };

      socket.on("disconnect", handleDisconnect);
      socket.on("face_capture_response", handleServerResponse);

      // 清理事件监听器
      return () => {
        socket.off("disconnect", handleDisconnect);
        socket.off("face_capture_response", handleServerResponse);
      };
    }
  }, [socket]); // 移除了collecting依赖，避免重复绑定事件监听器

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

  const handleStart = () => {
    if (!isConnected || !socket) {
      message.error("Socket未连接");
      return;
    }

    setCollecting(true);

    // 开始定时捕获并发送图片
    captureIntervalRef.current = setInterval(async () => {
      try {
        const blob = await takePhotoBlob();
        if (isConnected && socket) {
          const base64Image = await fileToBase64(blob);
          socket.emit("face_capture", {
            image: base64Image,
            id: userId,
          });
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
    if (response.success) {
      // 停止采集
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
        captureIntervalRef.current = null;
      }
      setCollecting(false);

      message.success("人脸采集完成");
      navigate("/Home");
    } else {
      // 如果服务器返回失败，继续采集
      console.log("人脸采集失败，继续采集...");
    }
  };

  const handleStop = () => {
    if (captureIntervalRef.current) {
      clearInterval(captureIntervalRef.current);
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
            disabled={collecting}
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