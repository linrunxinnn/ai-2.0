import aiApi from "../aiapi.js";
import { getUserInfo } from "../../store/slice/userSlice.js";
import { useSelector } from "react-redux";

//一个发送信息的接口
//在home页面的onSend回调中调用
export const sendMessage = async (message) => {
  console.log("发送信息：", message);
  var data = {}
  
  for(var i=0;i<30;i++)
  {
	  try {
	    console.log("发送信息的用户ID：", message);
	    const response = await aiApi.post("", { ...message });
		if (response.data.type == "processing"){
			console.log("处理请求中");
			await new Promise(resolve => setTimeout(resolve, 3000));
		}
		else 
		{
			console.log("发送信息成功，响应数据：", response.data);
			return response.data;
		}
	    
	  } catch (error) {
		console.log(error)
	    console.error("发送信息失败：", error);
	    throw error;
	  }
  }
  message.error("AI服务器处理请求超时");
  throw new Error()
  return null;
};

//一个用来轮询接收信息的接口
export const receiveMessages = async () => {
  var data = {}
	
  for(var i=0;i<1;i++)
  {
	  try {
	    const response = await aiApi.post("", {
	      user_id: JSON.parse(localStorage.getItem("user")).id,
	      type: "question",
	    });
	  
	    //!这里为什么返回为空
	    console.log("接收信息成功，响应数据：", response);
	    return response;
	  } catch (error) {
	    console.error("接收信息失败：", error);
	    throw error;
	  }
  }
};

//给ai返回一个用户的id
