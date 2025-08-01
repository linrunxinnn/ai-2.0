class FaceRecognitionSocketManager {
    constructor() {
        // 检查是否已存在实例
        if (FaceRecognitionSocketManager.instance) {
            return FaceRecognitionSocketManager.instance;
        }

        // WebSocket实例
        this.socket = null;

        // 连接状态
        this.isConnected = false;

        // 回调函数
        this.callbacks = {
            onFaceCaptureResponse: null,
            onFaceLoginResponse: null,
            onDisconnect: null,
            onError: null
        };

        // 重连相关
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.reconnectTimer = null;

        FaceRecognitionSocketManager.instance = this;
        return this;
    }

    // 获取WebSocket URL
    getWebSocketUrl() {
        const baseUrl = import.meta.env.VITE_SOCKET_URL || "ws://localhost:3000";
        return `${baseUrl}/face-recognition`;
    }

    // 初始化连接
    init() {
        if (this.socket && this.isConnected) {
            return Promise.resolve();
        }

        return new Promise((resolve, reject) => {
            try {
                this.socket = new WebSocket(this.getWebSocketUrl());

                // 监听连接打开事件
                this.socket.onopen = (event) => {
                    console.log("面部识别WebSocket连接已建立");
                    this.isConnected = true;
                    this.reconnectAttempts = 0;
                    resolve();
                };

                // 接收消息事件
                this.socket.onmessage = (event) => {
                    try {
                        const data = JSON.parse(event.data);

                        // 根据消息类型调用不同的回调函数
                        if (data.type === "face_capture_response" && this.callbacks.onFaceCaptureResponse) {
                            this.callbacks.onFaceCaptureResponse(data);
                        }

                        if (data.type === "face_login_response" && this.callbacks.onFaceLoginResponse) {
                            this.callbacks.onFaceLoginResponse(data);
                        }
                    } catch (error) {
                        console.error("解析WebSocket消息失败:", error);
                    }
                };

                // 监听WebSocket关闭事件
                this.socket.onclose = (event) => {
                    console.log("面部识别WebSocket连接已关闭", event);
                    this.isConnected = false;

                    // 触发断开连接回调
                    if (this.callbacks.onDisconnect) {
                        this.callbacks.onDisconnect();
                    }

                    // 尝试重连
                    if (this.reconnectAttempts < this.maxReconnectAttempts) {
                        this.reconnectTimer = setTimeout(() => {
                            this.reconnectAttempts++;
                            this.init();
                        }, 1000 * this.reconnectAttempts); // 逐步增加重连间隔
                    }
                };

                // 错误处理
                this.socket.onerror = (error) => {
                    console.error("面部识别WebSocket错误:", error);
                    this.isConnected = false;

                    if (this.callbacks.onError) {
                        this.callbacks.onError(error);
                    }
                };
            } catch (error) {
                console.error("初始化面部识别WebSocket失败:", error);
                reject(error);
            }
        });
    }

    // 设置回调函数
    setCallbacks(callbacks) {
        if (callbacks.onFaceCaptureResponse) {
            this.callbacks.onFaceCaptureResponse = callbacks.onFaceCaptureResponse;
        }

        if (callbacks.onFaceLoginResponse) {
            this.callbacks.onFaceLoginResponse = callbacks.onFaceLoginResponse;
        }

        if (callbacks.onDisconnect) {
            this.callbacks.onDisconnect = callbacks.onDisconnect;
        }

        if (callbacks.onError) {
            this.callbacks.onError = callbacks.onError;
        }
    }

    // 发送消息
    send(data) {
        if (this.isConnected && this.socket) {
            this.socket.send(JSON.stringify(data));
            return true;
        }
        return false;
    }

    // 断开连接
    disconnect() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.socket) {
            this.socket.close();
            this.socket = null;
        }

        this.isConnected = false;
        this.reconnectAttempts = 0;
    }

    // 获取连接状态
    getStatus() {
        return this.isConnected;
    }
}

// 创建并导出单例实例
const faceRecognitionSocketManager = new FaceRecognitionSocketManager();
export default faceRecognitionSocketManager;