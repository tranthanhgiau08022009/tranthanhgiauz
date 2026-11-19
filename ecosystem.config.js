// Cau hinh PM2 de giu server chay lien tuc tren VPS, tu dong restart khi crash.
// Cach dung:
//   npm install -g pm2
//   pm2 start ecosystem.config.js
//   pm2 save && pm2 startup

module.exports = {
  apps: [
    {
      name: 'digital-store-pro',
      script: 'server.js',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      max_memory_restart: '300M',
      autorestart: true,
      env: {
        NODE_ENV: 'production',
      },
      error_file: './logs/pm2-error.log',
      out_file: './logs/pm2-out.log',
      time: true,
    },
  ],
};
