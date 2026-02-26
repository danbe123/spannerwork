module.exports = {
  apps: [
    {
      name: 'spannerwork-backend',
      script: './dist/index.js',
      cwd: '/home/1566589.cloudwaysapps.com/wmmnrmcxxv/public_html/backend',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        // Load secrets from private directory (outside web root)
        DOTENV_PATH: '/home/1566589.cloudwaysapps.com/wmmnrmcxxv/private_html/.env.production',
      },
      // Logging - uses default PM2 logs in ~/.pm2/logs/
      merge_logs: true,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      // Restart policy
      max_restarts: 10,
      min_uptime: '10s',
      max_memory_restart: '500M',
      // Watch (disabled in production)
      watch: false,
    },
  ],
};
