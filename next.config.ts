import type { NextConfig } from "next";
import path from "path";

const envAllowed = process.env.ALLOWED_DEV_ORIGINS
	? process.env.ALLOWED_DEV_ORIGINS.split(",").map((s) => s.trim()).filter(Boolean)
	: [];

const defaultAllowed = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.0.113:3000",
];const nextConfig: NextConfig = {
	allowedDevOrigins: process.env.NODE_ENV === "production" ? [] : Array.from(new Set([...defaultAllowed, ...envAllowed])),
	turbopack: {
		root: path.resolve(__dirname),
	},
};

export default nextConfig;