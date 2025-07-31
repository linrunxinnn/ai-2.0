// src/pages/Personal.jsx
import React, { useEffect, useState } from "react";
import { Card, Descriptions, Spin, Alert, Button, Modal, Form, Input, Select, DatePicker, message } from "antd";
import { useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import style from "./Sign.module.css";
import api from "../api/index.js";
import dayjs from "dayjs"; // 需要安装 dayjs 来处理日期
import { changeUserData } from "../api/userservice/user.js";
import { setUserInfo } from "../store/slice/userSlice.js";

const Personal = () => {
    const [userInfo, setUserInform] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [form] = Form.useForm();

    const user = useSelector((state) => state.user);
    // const navigate = useNavigate();

    useEffect(() => {
        // 检查用户是否已登录
        // const storedUser = localStorage.getItem("user");
        // if (!storedUser && !user.id) {
        //     navigate("/sign");
        //     return;
        // }

        const fetchLocalUserInfo = () => {
            try {
                setLoading(true);

                // 从 localStorage 获取用户信息
                const storedUserInfo = localStorage.getItem('user');

                if (storedUserInfo) {
                    // 如果本地存储中有用户信息，解析并设置
                    const parsedUserInfo = JSON.parse(storedUserInfo);
                    console.log("从本地获取到的数据:", parsedUserInfo);
                    setUserInform(parsedUserInfo);
                } else {
                    // 如果本地没有信息，则使用默认值或从 Redux 获取
                    setUserInform({
                        id: user.id || 1,
                        username: user.username || "张三",
                        gender: "男",
                        ethnicity: "汉族",
                        phone: "138****8888",
                        idCard: "110***********0012",
                        birthplace: "北京市",
                        birthday: "1990-01-01",
                        email: "zhangsan@example.com",
                        occupation: "软件工程师",
                        address: "北京市朝阳区某某街道某某号",
                        residence: "北京市朝阳区某某街道某某号",
                        politicalStatus: "群众",
                        education: "本科",
                        religion: "无",
                        maritalStatus: "已婚"
                    });
                }
            } catch (err) {
                setError("获取本地用户信息失败");
                console.error("获取本地用户信息失败:", err);

                // 出错时使用默认值
                setUserInform({
                    id: user.id || 1,
                    username: user.username || "张三",
                    // ... 其他默认值
                });
            }
        }
        fetchLocalUserInfo()

        setLoading(false)
    }, []);

    //展示弹窗
    const showModal = () => {
        // 将生日字符串转换为 dayjs 对象，以便在 DatePicker 中正确显示
        const formData = {
            ...userInfo,
            birthday: userInfo.birthday ? dayjs(userInfo.birthday) : null
        };
        form.setFieldsValue(formData);
        setIsModalVisible(true);
    };
    //取消弹窗
    const handleCancel = () => {
        setIsModalVisible(false);
        form.resetFields();
    };
    //提交更改
    const handleSubmit = async (values) => {
        try {
            setLoading(true);

            // 将 dayjs 对象转换回字符串
            const submitData = {
                ...values,
                birthday: values.birthday ? values.birthday.format('YYYY-MM-DD') : null
            };
            let updatedUserInfo = null;
            // API请求
            const response = await changeUserData(submitData);
            if (response.status === 200) {
                message.success('更新成功');
                //更改本地数据
                try {
                    const storedUserInfo = localStorage.getItem('user');
                    if (storedUserInfo) {
                        const parsedUserInfo = JSON.parse(storedUserInfo);
                        updatedUserInfo = {
                            ...parsedUserInfo,
                            ...submitData
                        };
                        localStorage.setItem('user', JSON.stringify(updatedUserInfo));
                    }
                } catch (storageError) {
                    console.error('更新本地存储失败:', storageError);
                    // 不中断主流程，仅记录错误
                }
                //更改store的初始数据
                if (updatedUserInfo) {
                    dispatch(setUserInfo({
                        id: updatedUserInfo.id,
                        name: updatedUserInfo.name
                    }));
                }
            } else {
                message.error('更新失败，请重试');
            }
        } catch (err) {
            message.error('更新失败，请重试');
            console.error("更新用户信息失败:", err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className={style.main}>
                <div className={style.container} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px' }}>
                    <Spin size="large" tip="加载中..." />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className={style.main}>
                <div className={style.container}>
                    <Alert message="错误" description={error} type="error" showIcon />
                </div>
            </div>
        );
    }

    return (
        <div className={style.main}>
            <div className={style.container}>
                <Card
                    title="个人信息"
                    extra={<Button type="primary" onClick={showModal}>编辑信息</Button>}
                    style={{ width: '100%' }}
                >
                    <Descriptions bordered column={3} size="middle">
                        <Descriptions.Item label="用户名">{userInfo?.name}</Descriptions.Item>
                        <Descriptions.Item label="性别">{userInfo?.gender}</Descriptions.Item>
                        <Descriptions.Item label="民族">{userInfo?.ethnicity}</Descriptions.Item>
                        <Descriptions.Item label="手机号">{userInfo?.phone}</Descriptions.Item>
                        <Descriptions.Item label="身份证">{userInfo?.idCard}</Descriptions.Item>
                        <Descriptions.Item label="出生地">{userInfo?.birthplace}</Descriptions.Item>
                        <Descriptions.Item label="生日">{userInfo?.birthday}</Descriptions.Item>
                        <Descriptions.Item label="邮箱">{userInfo?.email}</Descriptions.Item>
                        <Descriptions.Item label="职业">{userInfo?.occupation}</Descriptions.Item>
                        <Descriptions.Item label="地址">{userInfo?.address}</Descriptions.Item>
                        <Descriptions.Item label="户口">{userInfo?.residence}</Descriptions.Item>
                        <Descriptions.Item label="政治面貌">{userInfo?.politicalStatus}</Descriptions.Item>
                        <Descriptions.Item label="学历">{userInfo?.education}</Descriptions.Item>
                        <Descriptions.Item label="宗教">{userInfo?.religion}</Descriptions.Item>
                        <Descriptions.Item label="婚姻状况">{userInfo?.maritalStatus}</Descriptions.Item>
                    </Descriptions>
                </Card>
                <Modal
                    title="编辑个人信息"
                    open={isModalVisible}
                    onOk={form.submit}
                    onCancel={handleCancel}
                    okText="确认"
                    cancelText="取消"
                    confirmLoading={loading}
                    width={800}
                >
                    <Form
                        form={form}
                        layout="vertical"
                        onFinish={handleSubmit}
                    >
                        <Form.Item name="name" label="用户名" rules={[{ required: true, message: '请输入用户名' }]}>
                            <Input />
                        </Form.Item>

                        <Form.Item name="gender" label="性别" rules={[{ required: true, message: '请选择性别' }]}>
                            <Select>
                                <Option value="男">男</Option>
                                <Option value="女">女</Option>
                            </Select>
                        </Form.Item>

                        <Form.Item name="nationality" label="民族" rules={[{ required: true, message: '请输入民族' }]}>
                            <Input />
                        </Form.Item>

                        <Form.Item name="phone" label="手机号" rules={[{ required: true, message: '请输入手机号' }]}>
                            <Input />
                        </Form.Item>

                        <Form.Item name="id_card" label="身份证" rules={[{ required: true, message: '请输入身份证号' }]}>
                            <Input />
                        </Form.Item>

                        <Form.Item name="native_place" label="出生地" rules={[{ required: true, message: '请输入出生地' }]}>
                            <Input />
                        </Form.Item>

                        <Form.Item name="birth" label="生日" rules={[{ required: true, message: '请选择生日' }]}>
                            <DatePicker style={{ width: '100%' }} />
                        </Form.Item>

                        <Form.Item name="email" label="邮箱" rules={[{ required: true, message: '请输入邮箱', type: 'email' }]}>
                            <Input />
                        </Form.Item>

                        <Form.Item name="career" label="职业" rules={[{ required: true, message: '请输入职业' }]}>
                            <Input />
                        </Form.Item>

                        <Form.Item name="address" label="地址" rules={[{ required: true, message: '请输入地址' }]}>
                            <Input />
                        </Form.Item>

                        <Form.Item name="hukou" label="户口" rules={[{ required: true, message: '请输入户口所在地' }]}>
                            <Input />
                        </Form.Item>

                        <Form.Item name="political_status" label="政治面貌" rules={[{ required: true, message: '请选择政治面貌' }]}>
                            <Select>
                                <Option value="群众">群众</Option>
                                <Option value="党员">党员</Option>
                                <Option value="预备党员">预备党员</Option>
                                <Option value="团员">团员</Option>
                            </Select>
                        </Form.Item>

                        <Form.Item name="education" label="学历" rules={[{ required: true, message: '请选择学历' }]}>
                            <Select>
                                <Option value="小学">小学</Option>
                                <Option value="初中">初中</Option>
                                <Option value="高中">高中</Option>
                                <Option value="专科">专科</Option>
                                <Option value="本科">本科</Option>
                                <Option value="硕士">硕士</Option>
                                <Option value="博士">博士</Option>
                            </Select>
                        </Form.Item>

                        <Form.Item name="religion" label="宗教" rules={[{ required: true, message: '请输入宗教信仰' }]}>
                            <Input />
                        </Form.Item>

                        <Form.Item name="marital_status" label="婚姻状况" rules={[{ required: true, message: '请选择婚姻状况' }]}>
                            <Select>
                                <Option value="未婚">未婚</Option>
                                <Option value="已婚">已婚</Option>
                                <Option value="离异">离异</Option>
                                <Option value="丧偶">丧偶</Option>
                            </Select>
                        </Form.Item>
                    </Form>
                </Modal>
            </div>
        </div>
    );
};

export default Personal;