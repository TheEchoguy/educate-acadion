import API from "../api/axiosConfig";

export const getMyProfile = async (email, usn) => {
  const params = {};
  if (email) params.email = email;
  if (usn) params.usn = usn;
  const res = await API.get("/profile/me", { params });
  return res.data;
};

export const updateMyProfile = async (profileData) => {
  const res = await API.put("/profile/update", profileData);
  return res.data;
};
