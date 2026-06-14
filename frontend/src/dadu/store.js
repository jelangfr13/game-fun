import { STARTING_BALANCE } from "./constants";

const API = "/api/user/coins";

function getToken() {
  return localStorage.getItem("gf_token");
}

export const Store = {
  async load() {
    const token = getToken();
    if (token) {
      try {
        const res = await fetch(API, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
          const data = await res.json();
          return data.coins;
        }
      } catch (e) {}
    }
    return STARTING_BALANCE;
  },

  async save(value) {
    const token = getToken();
    if (!token) return;
    try {
      await fetch(API, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ coins: Math.round(value) }),
      });
    } catch (e) {}
  },
};
