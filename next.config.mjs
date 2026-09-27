/** @type {import('next').NextConfig} */
const nextConfig = {
  // Lets phones on the same Wi-Fi / tunnels load the dev server.
  allowedDevOrigins: ["*.local", "*.trycloudflare.com", "*.ngrok-free.app", "*.loca.lt"],
};
export default nextConfig;
