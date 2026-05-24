module.exports = {
  apps: [
    {
      name: 'conveyai-backend',
      cwd: '/var/www/conveyai-backend',
      script: 'start-production.js',
      instances: 1,
      exec_mode: 'fork',
      max_memory_restart: '512M',
      restart_delay: 5000,
      max_restarts: 10,
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      error_file: '/var/www/conveyai-backend/logs/error.log',
      out_file: '/var/www/conveyai-backend/logs/out.log',
      merge_logs: true,
    }
  ]
};
