const sql = require("mssql");

const config = {
  user: "hoangdien_user", // Đúng chuẩn của mssql
  password: "Diendien1801@", // Đúng chuẩn của mssql
  server: "localhost", // Địa chỉ server (nếu chạy trên máy local)
  database: "ITHELPER", // Tên database
  port: 1433, // Port của SQL Server (1433 là mặc định)
  options: {
    encrypt: false, // Nếu dùng Azure SQL thì đổi thành true
    trustServerCertificate: true, // Bắt buộc nếu dùng localhost hoặc kết nối không có chứng chỉ SSL
  },
};

const poolPromise = new sql.ConnectionPool(config)
  .connect()
  .then((pool) => {
    console.log("✅ Kết nối thành công đến SQL Server!");
    return pool;
  })
  .catch((err) => {
    console.error("❌ Lỗi kết nối SQL Server:", err);
    process.exit(1);
  });

module.exports = { sql, poolPromise };
