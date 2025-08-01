import React, { useEffect, useRef, useState } from "react";
import { Button, message, Alert } from "antd";
import { useSelector } from "react-redux";
import style from "./Collect.module.css";
import { useNavigate } from "react-router-dom";
import { fileToBase64 } from "../utils/func.js";
import faceRecognitionSocketManager from "../utils/websocketCapture";

const Collect = () => {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const captureIntervalRef = useRef(null);
  const [collecting, setCollecting] = useState(false);
  const userId = useSelector((state) => state.user.id);
  const navigate = useNavigate();

  useEffect(() => {
    // 初始化WebSocket连接
    const initSocket = async () => {
      try {
        await faceRecognitionSocketManager.init();
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
      if (captureIntervalRef.current) {
        clearInterval(captureIntervalRef.current);
      }
      // 断开WebSocket连接
      faceRecognitionSocketManager.disconnect();
    };
  }, []);

  // Socket事件监听
  useEffect(() => {
    // 监听连接断开
    const handleDisconnect = () => {
      if (collecting) {
        handleStop();
        message.error("人脸采集服务连接已断开，采集已停止");
      }
    };

    // 监听服务器响应
    const handleServerResponse = (response) => {
      handleServerResponseInternal(response);
    };

    // 设置回调
    faceRecognitionSocketManager.setCallbacks({
      onFaceCaptureResponse: handleServerResponse,
      onDisconnect: handleDisconnect,
      onError: (error) => {
        console.error("WebSocket错误:", error);
        message.error("人脸采集服务发生错误");
      }
    });
  }, [collecting]);

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
    if (!faceRecognitionSocketManager.getStatus()) {
      message.error("人脸采集服务未连接");
      return;
    }

    setCollecting(true);

    // 第一个请求：只发送用户ID
    if (faceRecognitionSocketManager.getStatus()) {
      faceRecognitionSocketManager.send({
        type: "face_train",
        user_id: userId,
        hash: ""
      });
    }

    // 第二个请求：开始定时捕获并发送图片
    captureIntervalRef.current = setInterval(async () => {
      try {
        const blob = await takePhotoBlob();
        if (faceRecognitionSocketManager.getStatus()) {
          faceRecognitionSocketManager.send({
            type: "face_train",
            image: blob,
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
    if (response.message === "success") {
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
      message.error("人脸采集失败，请调整角度重试");
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