module.exports = {
  apps: [
    {
      name: "cronograma-saas",
      cwd: "/var/www/cronograma-saas",
      script: "npm",
      args: "start",
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      max_memory_restart: "600M",
      env: {
        NODE_ENV: "production",
        PORT: "3000",
      },
      out_file: "./logs/pm2-out.log",
      error_file: "./logs/pm2-error.log",
      merge_logs: true,
      time: true,
    },
  ],
};
