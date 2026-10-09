import API from "../api/axiosConfig";

export const registerUser = async (userData) => {
  const response = await API.post(
    "/auth/register",
    userData
  );

  return response.data;
};

export const verifyOtp = async (otpData) => {
  const response = await API.post(
    "/auth/verify-otp",
    otpData
  );

  return response.data;
};
export const loginUser = async (loginData) => {
  const response = await API.post(
    "/auth/login",
    loginData
  );

  return response.data;
};