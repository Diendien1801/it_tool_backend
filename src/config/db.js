const sql = require("mssql");

const config = {
  user: "hoangdien_user", 
  password: "Diendien1801@", 
  server: "localhost", 
  database: "ITHELPER", 
  port: 1433, 
  options: {
    encrypt: false, 
    trustServerCertificate: true, 
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
