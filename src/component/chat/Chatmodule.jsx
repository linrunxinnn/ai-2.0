import React, { useState, useRef, useEffect, useCallback } from "react";
import { Button, Input, message } from "antd";
import {
  SendOutlined,
  AudioOutlined,
  AudioMutedOutlined,
} from "@ant-design/icons";
import styles from "./ChatModule.module.css";
import { useSocket } from "../../hooks/useSocket";
import { jsPDF } from "jspdf";
import "jspdf-autotable";

const { TextArea } = Input;

const ChatModule = ({ onSend, initialMessages = [], getTitle }) => {
  // ========== 基础状态 ==========
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [activated, setActivated] = useState(false);
  const [isSending, setIsSending] = useState(false);

  // ========== 录音相关状态 ==========
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudio, setRecordedAudio] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [playingStatus, setPlayingStatus] = useState({});

  // ========== refs ==========
  const messageEndRef = useRef(null);
  const recognitionRef = useRef(null);
  const scrollRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false); //记录播放状态

  const user = JSON.parse(localStorage.getItem("user"));
  const userId = user?.id;
  const [index, setIndex] = useState(Date.now());

  // Socket连接
  const { socket, isConnected } = useSocket();

  // ========== Socket事件监听 ==========
  useEffect(() => {
    if (!socket) return;

    const handleTextMessage = (data) => {
      console.log("收到文字消息:", data);
      if (userId === data.userId) return;
      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(),
          content: data.content,
          role: "assistant",
          timestamp: new Date(),
        },
      ]);
      setIsSending(false);
    };

    const handleAudioMessage = (data) => {
      console.log("收到语音消息:", data);

      const audioBlob = new Blob([data.input.content], {
        type: `audio/${data.input.format || "webm"}`,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: Date.now(), // 使用更可靠的ID
          content: "[AI语音回复]",
          role: "assistant",
          timestamp: new Date(),
          type: "audio",
          audioBlob: audioBlob,
          format: data.input.format,
        },
      ]);

      setIsSending(false);
    };

    const handleSummary = (data) => {
      console.log("收到总结:", data);
      if (data.user_id === userId) {
        generatePDF(data.output);
        message.success("总结已生成并下载");
      }
      setIsSending(false);
    };

    const handlePushData = (data) => {
      console.log("收到推送数据:", data);
      // 将输出存储到后台
    };

    const handleTableData = (data) => {
      console.log("收到表格数据:", data);
      if (data.user_id === userId) {
        setMessages((prev) => [
          ...prev,
          {
            id: Date.now(), // 生成唯一ID
            type: "table",
            content: data.title || "表格数据", // 使用传入的标题或默认值
            role: "assistant", // 标记为AI消息
            timestamp: new Date(), // 当前时间
            tableData: {
              header: data.tabledData?.header || {}, // 确保header存在，即使为空对象
              row: data.tableData?.row || [], // 确保row存在，即使为空数组
            },
          },
        ]);
      }
    };

    const handleError = (error) => {
      console.error("Socket错误:", error);
      message.error("连接错误: " + error.message);
      setIsSending(false);
    };

    const handleProcessing = () => {
      console.log("AI正在处理中...");
    };

    // 监听Socket事件
    socket.on("text_message", handleTextMessage);
    socket.on("audio_message", handleAudioMessage);
    socket.on("summary", handleSummary);
    socket.on("push_data", handlePushData);
    socket.on("table_data", handleTableData);
    socket.on("processing", handleProcessing);
    socket.on("error", handleError);

    return () => {
      socket.off("text_message", handleTextMessage);
      socket.off("audio_message", handleAudioMessage);
      socket.off("summary", handleSummary);
      socket.off("push_data", handlePushData);
      socket.off("table_data", handleTableData);
      socket.off("processing", handleProcessing);
      socket.off("error", handleError);
    };
  }, [socket]);

  // ========== 录音核心功能 ==========

  // 开始录音
  const startRecording = async () => {
    try {
      console.log("准备开始录音...");

      // 清理之前的录音数据
      cleanupRecording();

      // 检查浏览器支持
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        message.error("您的浏览器不支持录音功能");
        return;
      }

      // 获取麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
          channelCount: 1,
        },
      });

      // 创建录音器
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });

      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      // 录音数据收集
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // 录音完成处理
      mediaRecorder.onstop = () => {
        console.log("录音器停止，处理数据...");
        processRecordedAudio(stream);
      };

      // 开始录音
      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingDuration(0);

      // 开始计时
      startRecordingTimer();

      message.success("开始录音");
      console.log("录音已开始");
    } catch (error) {
      console.error("开始录音失败:", error);
      message.error("无法访问麦克风，请检查权限设置");
      cleanupRecording();
    }
  };

  // 停止录音
  const stopRecording = () => {
    console.log("停止录音...");

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }

    // 停止计时
    stopRecordingTimer();
    setIsRecording(false);

    console.log("录音停止指令已发出");
  };

  // 处理录制完成的音频
  const processRecordedAudio = (stream) => {
    try {
      console.log("处理录音数据，chunks数量:", audioChunksRef.current.length);

      // 停止所有音频轨道
      if (stream) {
        stream.getTracks().forEach((track) => {
          track.stop();
          console.log("音频轨道已停止:", track.kind);
        });
      }

      if (audioChunksRef.current.length === 0) {
        message.error("录音数据为空");
        return;
      }

      // 创建音频Blob
      const audioBlob = new Blob(audioChunksRef.current, {
        type: "audio/webm",
      });

      console.log("录音文件大小:", audioBlob.size, "bytes");

      // 检查录音质量
      if (audioBlob.size < 1000) {
        message.error("录音时间太短，请重新录制");
        return;
      }

      if (audioBlob.size > 10 * 1024 * 1024) {
        message.error("录音文件过大，请重新录制");
        return;
      }

      // 保存录音数据
      setRecordedAudio(audioBlob);
      message.success(`录音完成，时长: ${recordingDuration}秒`);
    } catch (error) {
      console.error("处理录音数据失败:", error);
      message.error("录音处理失败，请重试");
    }
  };

  // ========== 录音计时器 ==========
  const startRecordingTimer = () => {
    recordingTimerRef.current = setInterval(() => {
      setRecordingDuration((prev) => {
        const newDuration = prev + 1;

        // 60秒自动停止
        if (newDuration >= 60) {
          stopRecording();
          message.warning("录音时间已达60秒限制，自动停止");
        }

        return newDuration;
      });
    }, 1000);
  };

  const stopRecordingTimer = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  // ========== 发送录音 ==========
  const sendRecordedAudio = async () => {
    if (!recordedAudio) {
      message.error("没有录音数据");
      return;
    }

    if (!socket || !isConnected) {
      message.error("连接未建立，请稍后重试");
      return;
    }

    try {
      setIsSending(true);
      console.log("准备发送录音...");

      // 转换为ArrayBuffer
      const arrayBuffer = await recordedAudio.arrayBuffer();

      // 添加用户消息到界面
      const userMessage = {
        id: Date.now(),
        content: `[语音消息 ${Math.round(recordingDuration)}秒]`,
        role: "user",
        timestamp: new Date(),
        type: "audio",
        audioBlob: recordedAudio,
      };

      setMessages((prev) => [...prev, userMessage]);

      // 如果是第一条消息，获取标题
      if (messages.length === 0) {
        getTitle("政务服务办理");
      }

      setActivated(true);

      // 通过Socket发送
      socket.emit("audio_message", {
        user_id: userId,
        info: { ...user },
        input: {
          type: "audio",
          content: arrayBuffer,
          format: "webm",
          duration: recordingDuration,
        },
      });

      console.log("录音发送成功，大小:", arrayBuffer.byteLength, "bytes");
      message.success("语音消息发送成功");

      // 清理录音数据
      setRecordedAudio(null);
      setRecordingDuration(0);
    } catch (error) {
      console.error("发送录音失败:", error);
      message.error("发送语音消息失败，请重试");
      setIsSending(false);
    }
  };

  // ========== 音频播放 ==========
  const playAudioFromBuffer = (audioBuffer, id) => {
    try {
      if (isPlaying) {
        message.warning("请等待当前音频播放完毕");
        return;
      }
      setIsPlaying(true);
      console.log("播放音频，大小:", audioBuffer.byteLength);

      const audioBlob = new Blob([audioBuffer], { type: "audio/wav" });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      setPlayingStatus((prev) => ({ ...prev, [id]: true }));

      audio.addEventListener("ended", () => {
        console.log("音频播放完成");
        setPlayingStatus((prev) => ({ ...prev, [id]: false }));
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
      });

      audio.addEventListener("error", (e) => {
        console.error("音频播放错误:", e);
        setPlayingStatus((prev) => ({ ...prev, [id]: false }));
        setIsPlaying(false);
        URL.revokeObjectURL(audioUrl);
        message.error("音频播放失败");
      });

      audio.play().catch((err) => {
        console.error("播放失败:", err);
        setIsPlaying(false);
        setPlayingStatus((prev) => ({ ...prev, [id]: false }));
        URL.revokeObjectURL(audioUrl);
        message.error("音频播放失败");
      });
    } catch (error) {
      console.error("创建音频播放器失败:", error);
      setIsPlaying(false);
      setPlayingStatus((prev) => ({ ...prev, [id]: false }));
      message.error("音频播放失败");
    }
  };

  // 播放用户录音
  const playUserAudio = (audioBlob, id) => {
    if (isPlaying) {
      message.warning("请等待当前音频播放完毕");
      return;
    }
    setIsPlaying(true);
    try {
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      setPlayingStatus((prev) => ({ ...prev, [id]: true }));

      audio.addEventListener("ended", () => {
        setPlayingStatus((prev) => ({ ...prev, [id]: false }));
        URL.revokeObjectURL(audioUrl);
        setIsPlaying(false);
      });

      audio.addEventListener("error", () => {
        setPlayingStatus((prev) => ({ ...prev, [id]: false }));
        URL.revokeObjectURL(audioUrl);
        message.error("播放失败");
        setIsPlaying(false);
      });

      audio.play().catch(() => {
        setPlayingStatus((prev) => ({ ...prev, [id]: false }));
        URL.revokeObjectURL(audioUrl);
        message.error("播放失败");
        setIsPlaying(false);
      });
    } catch (error) {
      console.error("播放用户音频失败:", error);
      message.error("播放失败");
      setIsPlaying(false);
    }
  };

  // 播放音频消息 (原有函数)
  const playAudioMessage = (audioUrl) => {
    if (isPlaying) {
      message.warn("正在播放其他音频");
      return;
    }
    const audio = new Audio(audioUrl);
    audio.play().catch((err) => {
      console.error("播放音频失败:", err);
      message.error("播放音频失败");
    });
  };

  // ========== 资源清理 ==========
  const cleanupRecording = () => {
    console.log("清理录音资源...");

    // 停止录音器
    if (mediaRecorderRef.current) {
      if (mediaRecorderRef.current.state === "recording") {
        mediaRecorderRef.current.stop();
      }
      mediaRecorderRef.current = null;
    }

    // 停止计时器
    stopRecordingTimer();

    // 清理音频数据
    audioChunksRef.current = [];

    // 重置状态
    setIsRecording(false);
    setRecordingDuration(0);

    console.log("录音资源已清理");
  };

  // ========== 按钮控制逻辑 ==========
  const toggleRecording = () => {
    if (isRecording) {
      // 正在录音，点击停止
      stopRecording();
    } else if (recordedAudio) {
      // 有录音数据，点击发送
      sendRecordedAudio();
    } else {
      // 开始录音
      startRecording();
    }
  };

  // ========== 组件清理 ==========
  useEffect(() => {
    return () => {
      console.log("组件卸载，清理录音资源");
      cleanupRecording();
    };
  }, []);

  // ========== 文字消息发送 ==========
  const handleSend = useCallback(async () => {
    if (!socket || !isConnected) {
      message.error("连接未建立，请稍后重试");
      return;
    }

    if (!input.trim()) return;

    setIsSending(true);

    // 停止语音识别
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }

    const newMessage = {
      content: input.trim(),
      role: "user",
      timestamp: new Date(),
    };

    // 如果为第一条信息，则调用getTitle函数
    if (messages.length === 0) {
      getTitle(newMessage.content);
    }

    try {
      setActivated(true);

      // 通过Socket发送文字消息
      socket.emit("text_message", {
        user_id: userId,
        info: { ...user },
        input: {
          type: "text",
          content: newMessage.content,
        },
      });

      setMessages((prev) => [...prev, newMessage]);
      console.log("发送文字信息：", newMessage.content);
      setInput("");
    } catch (error) {
      console.error("发送消息失败:", error);
      message.error("发送信息失败，请稍后重试");
      setIsSending(false);
    }
  }, [
    socket,
    isConnected,
    input,
    messages.length,
    userId,
    user,
    isListening,
    getTitle,
  ]);

  // ========== PDF生成 ==========
  const generatePDF = (output) => {
    const doc = new jsPDF();

    doc.setFontSize(18);
    doc.text("政务服务办理摘要", 105, 20, { align: "center" });

    doc.setFontSize(14);
    doc.text(`业务分类: ${output.classify}`, 15, 40);

    doc.setFontSize(12);
    doc.text("相关信息表格:", 15, 60);

    const tableData = output.tables.map((item) => [
      item.name || "",
      item.age || "",
      item.gender || "",
      item.idNumber || "",
    ]);

    doc.autoTable({
      startY: 65,
      head: [["姓名", "年龄", "性别", "身份证号"]],
      body: tableData,
      theme: "grid",
      headStyles: {
        fillColor: [22, 160, 133],
        textColor: 255,
      },
    });

    doc.setFontSize(12);
    doc.text("办理流程:", 15, doc.autoTable.previous.finalY + 20);

    const splitText = doc.splitTextToSize(output.flow, 180);
    doc.text(splitText, 15, doc.autoTable.previous.finalY + 30);

    const date = new Date().toLocaleString();
    doc.setFontSize(10);
    doc.text(`生成时间: ${date}`, 15, doc.internal.pageSize.height - 10);

    doc.save(`政务服务摘要_${output.classify}.pdf`);
  };

  // ========== 滚动控制 ==========
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // ========== 键盘事件 ==========
  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ========== 获取录音按钮显示文本 ==========
  const getRecordButtonText = () => {
    if (isRecording) {
      return `录音中 ${recordingDuration}s`;
    } else if (recordedAudio) {
      return `发送录音 (${recordingDuration}s)`;
    } else {
      return "开始录音";
    }
  };

  // ========== 渲染输入区域 ==========
  const renderInputArea = () => (
    <div
      className={activated ? styles.chatFooter : styles.initialInputContainer}
    >
      {!isConnected && (
        <div className={styles.connectionStatus}>连接已断开，正在重连...</div>
      )}
      <div className={styles.inputArea}>
        <TextArea
          className={styles.textArea}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          autoSize={{ minRows: 2, maxRows: 5 }}
          placeholder="请输入内容..."
        />
        <div className={styles.chatActions}>
          <Button
            icon={isRecording ? <AudioMutedOutlined /> : <AudioOutlined />}
            onClick={toggleRecording}
            className={`${styles.recordButton} ${
              isRecording ? styles.recording : ""
            }`}
            type={isRecording || recordedAudio ? "primary" : "default"}
            danger={isRecording}
            disabled={isSending || !isConnected}
          >
            {getRecordButtonText()}
          </Button>

          {recordedAudio && !isRecording && (
            <Button
              onClick={() => {
                setRecordedAudio(null);
                setRecordingDuration(0);
              }}
              disabled={isSending}
              className={styles.cancelButton}
            >
              取消录音
            </Button>
          )}

          <Button
            type="primary"
            icon={<SendOutlined />}
            onClick={handleSend}
            disabled={!input.trim() || isSending || !isConnected}
            className={styles.sendButton}
          >
            发送
          </Button>
        </div>
      </div>
    </div>
  );

  // ========== 如果未激活，显示初始居中布局 ==========
  if (!activated) {
    return (
      <div className={styles.chatWrapper}>
        <div className={styles.initialState}>
          <h1 className={styles.title}>欢迎来到多智能体协同辅助政务服务助手</h1>
          {renderInputArea()}
        </div>
      </div>
    );
  }

  // ========== 激活后的布局 ==========
  return (
    <div className={styles.chatWrapper}>
      <div className={styles.activatedLayout}>
        <div className={styles.chatContent} ref={scrollRef}>
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`${styles.chatMessage} ${
                msg.role === "user" ? styles.messageRight : styles.messageLeft
              }`}
            >
              <div
                className={
                  msg.role === "user"
                    ? styles.chatMessageUser
                    : styles.chatMessageAI
                }
              >
                {msg.type === "audio" ? (
                  <div className={styles.audioMessage}>
                    <span>{msg.content}</span>

                    {/* 用户音频播放按钮 */}
                    {msg.role === "user" && msg.audioBlob && (
                      <Button
                        size="small"
                        onClick={() => playUserAudio(msg.audioBlob, msg.id)}
                        disabled={playingStatus[msg.id]}
                        className={styles.playButton}
                      >
                        {playingStatus[msg.id] ? "播放中..." : "播放"}
                      </Button>
                    )}

                    {/* AI音频播放按钮 */}
                    {msg.role === "assistant" && msg.audioBlob && (
                      <Button
                        size="small"
                        onClick={() =>
                          playAudioFromBuffer(msg.audioBlob, msg.id)
                        }
                        disabled={playingStatus[msg.id]}
                        className={styles.playButton}
                      >
                        {playingStatus[msg.id] ? "播放中..." : "播放"}
                      </Button>
                    )}

                    {/* 兼容原有的audioUrl */}
                    {msg.audioUrl && !msg.audioBuffer && !msg.audioBlob && (
                      <Button
                        size="small"
                        onClick={() => playAudioMessage(msg.audioUrl)}
                        className={styles.playButton}
                      >
                        播放
                      </Button>
                    )}
                  </div>
                ) : msg.type === "table" ? (
                  // 新增表格渲染逻辑
                  <div className={styles.dynamicTable}>
                    {msg.content && (
                      <div className={styles.tableTitle}>{msg.content}</div>
                    )}

                    <div className={styles.tableScrollWrapper}>
                      <table>
                        {/* 自动生成表头（如果header为空则使用第一行数据的key） */}
                        <thead>
                          <tr>
                            {(Object.keys(msg.tableData.header).length > 0
                              ? Object.entries(msg.tableData.header)
                              : msg.tableData.row[0]
                              ? Object.keys(msg.tableData.row[0]).map((key) => [
                                  key,
                                  key,
                                ])
                              : []
                            ).map(([key, title]) => (
                              <th key={key}>{title}</th>
                            ))}
                          </tr>
                        </thead>

                        {/* 表体 */}
                        <tbody>
                          {msg.tableData.row.map((row, rowIndex) => (
                            <tr key={rowIndex}>
                              {(Object.keys(msg.tableData.header).length > 0
                                ? Object.keys(msg.tableData.header)
                                : Object.keys(row || {})
                              ).map((key) => (
                                <td key={`${rowIndex}-${key}`}>
                                  {row?.[key] ?? ""}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ) : (
                  // 默认文本渲染
                  <span className={styles.textContent}>{msg.content}</span>
                )}
              </div>
            </div>
          ))}
          <div ref={messageEndRef} />
        </div>
        {renderInputArea()}
      </div>
    </div>
  );
};

export default ChatModule;
