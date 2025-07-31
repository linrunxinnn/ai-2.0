import "./App.css";
import { Outlet } from "react-router-dom";
import { useEffect } from "react";
import { useDispatch } from "react-redux";
import { setUserInfo } from "./store/slice/userSlice.js";

function App() {
  const dispatch = useDispatch();
  //写一个死的user存到localstorage
  const userr = {
    id: 1,
    name: "测试用户",
  };
  localStorage.setItem("user", JSON.stringify(userr));

  useEffect(() => {
    if (localStorage.getItem("user")) {
      // 如果用户信息存在，则将其存储到 Redux 中
      const user = JSON.parse(localStorage.getItem("user"));
      const info = {
        id: user.id,
        name: user.name,
      };
      dispatch(setUserInfo(info));
    }
  }, []);

  return (
    <>
      <Outlet className="outlet" />
    </>
  );
}

export default App;
