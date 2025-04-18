var express = require('express');
const path = require('path');
var router = express.Router();
const fs = require('fs');
const multer = require('multer');
const db = require('../config/db');


// Multer Configuration for File Uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = 'uploads/';
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true }); // Create uploads folder if not exists
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File Filter (Allow only images)
const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith('image/')) {
    cb(null, true);
  } else {
    cb(new Error('Only image files are allowed!'), false);
  }
};

// Multer Upload Setup
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB max file size
});


// Endpoint for file upload
// authenticateToken
router.post('/uploadFile', upload.single('file'), async (req, res) => {
  try {
      var dirName = req.body.directoryName;
      var uploadedName = req.file.filename;
      var originalName = req.file.originalname;
      var size = (req.file.size / 1024).toFixed(2); //KB

      const results = await db.executeQuery(
          'INSERT INTO uploads(dir, name, filename, size) values(?,?,?,?);',
          [dirName, uploadedName, originalName, size]
      );

      if (results.affectedRows > 0) {
          // Successfully created
          res.status(201).json({ status: 'success', message: 'File Upload Successfully' });
      } else {
          // In case of unexpected behavior
          res.status(500).json({ status: 500, error: 'File Upload failed due to an unknown error' });
      }
  } catch (err) {
      console.log(err)
      res.send({
          status: 'error',
          message: 'File upload failed',
      });
  }
});

// Endpoint for get all photos
router.get('/getAllPhotos', async (req, res) => {
  try {
      const results = await db.executeQuery(
          `SELECT * 
          FROM uploads
          WHERE LOWER(filename) LIKE '%.jpg'
             OR LOWER(filename) LIKE '%.jpeg'
             OR LOWER(filename) LIKE '%.png'
             OR LOWER(filename) LIKE '%.gif';`,
          []
      );

      if (results.length > 0) {
          // Successfully created
          res.status(200).json({ status: 'success', message: 'File Fetched successfully', files: results });
      } else {
          // In case of unexpected behavior
          res.status(200).json({ status: 'success', message: 'No Photo Found', files:[] });
      }
  } catch (err) {
      res.send({
          status: 500,
          message: 'Failed to Fetch',
      });
  }
});

// Endpoint for get photos
router.delete('/deleteFile', async (req, res) => {
  try {
      const { fid } = req.body;

      const results = await db.executeQuery(
          'select name from uploads WHERE fid = ?;',
          [fid]
      );
      if (results.length) {
          const filePath = path.join(__dirname, `../uploads/${results[0].name}`);
          fs.unlink(filePath, async (err) => {
              if (err) {
                  console.error('Error deleting file:', err);
                  return res.send({ status: 'error', message: 'Error deleting file' });
              }

              const results = await db.executeQuery(
                  'DELETE FROM uploads WHERE fid = ?;',
                  [fid]
              );

              if (results.affectedRows > 0) {
                  res.status(200).json({ status: 'success', message: 'File Deleted successfully' });
              } else {
                  // In case of unexpected behavior
                  res.status(200).json({ status: 'success', message: 'Failed to Delete' });
              }
          });
      } else {
          res.status(200).json({ status: 'success', message: 'Failed to Delete' });
      }
  } catch (err) {
      res.send({
          status: 500,
          message: 'Failed to Delete',
      });
  }
});

/* GET home page. */
router.get('/', function (req, res, next) {
  res.render('index', { title: 'Express' });
});


//Login
router.post('/login', async function (req, res, next) {
  const { username, password } = req.body;
  try {
      const results = await db.executeQuery('SELECT * FROM users WHERE uname = ? and password = ?;', [username, password]);
      if (results.length) {
          res.status(200).send({ status: "success", results: results[0] });
      } else {
          res.status(200).send({ status: "failed", message: "No User Found" });
      }
  } catch (err) {
      console.error('Error fetching users:', err.message);
      res.status(500).json({ error: 'Internal Server Error' });
  }
});


//Update User
router.put('/updateProfile', async function (req, res, next) {
  const { uname, name, email, mobile } = req.body;
  console.log(req.body)
  try {
      var dynQuery = []; 
      var updatingData = [];
      if(name){dynQuery.push('name=?');updatingData.push(name)}
      if(email){dynQuery.push('email=?');updatingData.push(email)}
      if(mobile){dynQuery.push('mobile=?');updatingData.push(mobile)}
      updatingData.push(uname);
      const results = await db.executeQuery(
          `UPDATE users SET ${dynQuery.join(',')} WHERE uname=?;`,updatingData          
      );
      if (results.affectedRows > 0) {
          // Successfully created
          const results = await db.executeQuery('SELECT * FROM users WHERE uname = ?;', [uname]);
          res.status(201).json({ status: 'success', message: 'User Updated successfully', results:results[0] });
      } else {
          // In case of unexpected behavior
          res.status(500).json({ status: 500, error: 'User updation failed due to an unknown error' });
      }
  } catch (err) {
      console.error('Error fetching users:', err.message);
      res.status(500).json({ message: 'User updation failed', status: 500 });
  }
});

//Add Staff
router.post('/addStaff', async function (req, res, next) {
  const { name, designation, email, department, phone } = req.body;
  try {

      const checkUser = await db.executeQuery('SELECT * FROM staff WHERE name = ?;', [name]);

      if (checkUser.length) {
          res.status(500).json({ status: 500, message: 'Staff Already Exist' });
      } else {
          const results = await db.executeQuery(
              'INSERT INTO staff(name, designation, department, email, phone) values(?,?,?,?,?);',
              [name, designation, email, department, phone]
          );

          if (results.affectedRows > 0) {
              // Successfully created
              const data = await db.executeQuery('SELECT * FROM staff;', []);
              res.status(201).json({ status: 'success', message: 'Staff Added Successfully', results: data });
          } else {
              // In case of unexpected behavior
              res.status(500).json({ status: 500, message: 'Staff creation failed due to an unknown error' });
          }
      }
  } catch (err) {
      console.error('Error fetching users:', err.message);
      res.status(500).json({ message: 'Staff creation failed', status: 500 });
  }
});

router.get('/getStaff', async function (req, res, next) {
  try {
      const results = await db.executeQuery(
          'SELECT * FROM staff;',
          []
      );
      if (results.length) {
          // Successfully created
          res.status(201).json({ status: 'success', results: results });
      } else {
          // In case of unexpected behavior
          res.status(404).json({ status: 200, message: 'No Staff Available' });
      }
  } catch (err) {
      console.error('Error fetching link:', err.message);
      res.status(500).json({ message: 'Staff fetching failed', status: 500 });
  }
});




















router.post('/add-student', upload.single('photo'), async function (req, res, next) {
  try {
    // Extract Form Data
    const {
      student_name, fathers_name, fathers_occupation, mothers_name, mothers_occupation, gender, email,
      mobile, adhaar, caste, school_name, roll_number, present_at, present_post, present_ps, present_dist,
      present_pincode, present_contactno, permanent_at, permanent_post, permanent_ps, permanent_dist,
      permanent_pincode, permanent_contactno, transaction_id
    } = req.body;

    // Get Uploaded File Path
    let photo_path = req.file ? `/uploads/${req.file.filename}` : null;

    // Validation: Required fields check
    if (!student_name || !fathers_name || !mothers_name || !gender || !email || !mobile || !adhaar) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({
        success: false,
        message: 'Missing required fields. Please check your input.'
      });
    }

    

    const sql = `INSERT INTO students 
        (student_name, fathers_name, fathers_occupation, mothers_name, mothers_occupation, gender, email, mobile, 
        adhaar, caste, school_name, roll_number, present_at, present_post, present_ps, present_dist, present_pincode, 
        present_contactno, permanent_at, permanent_post, permanent_ps, permanent_dist, permanent_pincode, 
        permanent_contactno, photo_path, transaction_id) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

    const values = [student_name, fathers_name, fathers_occupation, mothers_name, mothers_occupation, gender, email,
      mobile, adhaar, caste, school_name, roll_number, present_at, present_post, present_ps, present_dist,
      present_pincode, present_contactno, permanent_at, permanent_post, permanent_ps, permanent_dist,
      permanent_pincode, permanent_contactno, photo_path, transaction_id];

    // Execute the Query
    const results = await db.executeQuery(sql, values);

    if (results) {
      res.status(201).json({
        success: true,
        message: 'Student record inserted successfully.',
        insertedId: results.insertId,
        photo_path: photo_path
      });
    } else {
      if (req.file) fs.unlinkSync(req.file.path);
        
      return res.status(500).json({
        success: false,
        message: 'Database error. Please try again.',
        error: err.sqlMessage
      });
    }


  } catch (error) {
    if (req.file) fs.unlinkSync(req.file.path);
    if (error.code === 'ER_DUP_ENTRY') {
      let msg = error.sqlMessage.split(" ");;
      let len = msg.length;
      res.status(400).json({
        success: false,
        message: `Record is already available with the inserted ${msg[len - 1]}`,
        error: error.sqlMessage
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Internal server error. Please try again.',
        error: error.message
      });
    }
  }
});

router.get('/get-students', async function (req, res, next) {
  try {
    const sql = "SELECT * FROM students"
    const results = await db.executeQuery(sql, []);

    if (results.length > 0) {
      res.status(200).json({ status: 'success', message: 'File Fetched successfully', files: results });
    } else {
      res.status(200).json({ status: 'success', error: 'No Record Found' });
    }

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Internal server error. Please try again.',
      error: error.message
    });
  }
});

router.get('/files/:filename', (req, res) => {
  const fileName = req.params.filename;
  // Construct the file path
  const filePath = path.join(__dirname, '../uploads', fileName);
  // Check if the file exists before serving
  res.sendFile(filePath, (err) => {
      if (err) {
          console.error('Error sending file:', err);
          res.status(404).send('File not found');
      }
  });
});





module.exports = router;
