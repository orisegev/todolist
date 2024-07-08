const express = require('express');
const session = require('express-session');
const bodyParser = require('body-parser');
const crypto = require('crypto');
const mysql = require('mysql');
// bcrypt
const bcrypt = require('bcrypt');
const saltRounds = 10;

// mysql configuration
const connection = mysql.createConnection({
    host: 'localhost',
    user: 'todolist',
    password: '',
    database: 'todolist_db'
});

// Connect to mysql
connection.connect((err) => {
    if (err) {
        console.error('Error connecting to database: ' + err.stack);
        return;
    }
    console.log('Connected to database');
});

const secret = crypto.randomBytes(64).toString('hex');
console.log(secret);

const app = express();

// Set up middleware
app.set('view engine', 'ejs');
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));


app.use(session({
    secret: secret,
    resave: false,
    saveUninitialized: true,
	cookie: { secure: false } // Set to true if using HTTPS
}));

/*app.get('/taskslist', (req, res) => {
    if (req.session.loggedIn) {
		const query = 'SELECT * FROM tasks WHERE uid = ?';
		connection.query(query, [req.session.uid], (err, results) => {
			if (err) {
				console.error('Error fetching tasks:', err);
				res.status(500).send('Internal Server Error');
				return;
			}
			res.json(results);
		});
	}
});*/

app.get('/', (req, res) => {
	if (req.session.loggedIn) {
		const query = 'SELECT * FROM tasks WHERE uid = ? ORDER BY taskid DESC';
		connection.query(query, [req.session.uid], (err, results) => {
			if (err) {
				console.error('Error fetching tasks:', err);
				res.status(500).send('Internal Server Error');
				return;
			}
			res.render('index', { tasks: results });
		});
	} else {
		res.render('login', { message1: false });
	}
});

app.post('/add-task', (req, res) => {
	console.log(req.body);
	if (req.session.loggedIn) {
		const { task } = req.body;
		const sql = 'INSERT INTO tasks (task,uid) VALUES (?, ?)';

		connection.query(sql, [task, req.session.uid], (err, result) => {
			if (err) {
			  console.error(err);
			  res.status(500).send('Error inserting data');
			  return;
			}
			//res.send('Data inserted successfully');
			res.json({ taskId: result.insertId });
		});
	} else {
		res.render('login', { message1: false });
	}
});

app.delete('/tasks/:id', (req, res) => {
    const taskid = req.params.id;
    connection.query('DELETE FROM tasks WHERE taskid = ? AND uid = ?', [taskid, req.session.uid], (error, results, fields) => {
        if (error) {
            console.error('Error deleting task:', error);
            res.status(500).json({ message: 'Failed to delete task' });
            return;
        }
        res.json({ message: 'task deleted successfully' });
    });
});

app.post('/task-mark/:id', (req, res) => {
    const taskid = req.params.id;
    connection.query('UPDATE tasks SET mark = 1 WHERE taskid = ? AND uid = ?', [taskid, req.session.uid], (error, results, fields) => {
        if (error) {
            console.error('Error marking task:', error);
            res.status(500).json({ message: 'Failed to mark task' });
            return;
        }
        res.json({ message: 'task mark successfully' });
    });
});

app.post('/task-unmark/:id', (req, res) => {
    const taskid = req.params.id;
    connection.query('UPDATE tasks SET mark = 0 WHERE taskid = ? AND uid = ?', [taskid, req.session.uid], (error, results, fields) => {
        if (error) {
            console.error('Error unmarking task:', error);
            res.status(500).json({ message: 'Failed to mark task' });
            return;
        }
        res.json({ message: 'task unmark successfully' });
    });
});

app.post('/login', (req, res) => {
	const { username, password } = req.body;
	//console.log(`Username: ${username}, Password: ${password}`);
    connection.query('SELECT * FROM users WHERE username = ? ', [username], (err, results) => {
        if (err || !results) {
            console.error('Error querying database: ' + err.stack);
            res.status(500).send('Database error');
            return;
        }
        else if (results.length > 0) {
			const user = results[0];
            
			bcrypt.compare(password, user.password, (err, result) => {
				if (err || !result) {
					res.redirect('/');
                    return;
                }
				req.session.loggedIn = true;
				req.session.username = results[0].username;
				req.session.uid = results[0].uid;
				res.redirect('/');
			});
        } else {
			res.render('login', { message1: true });
        }
    });
});

app.get('/login', (req, res) => {
	if (req.session.loggedIn) {
		res.render('login', { message1: false });
	} else {
		res.redirect('/');
	}
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.redirect('/');
    }
    res.clearCookie('connect.sid');
    res.redirect('/login');
  });
});

app.get('/register', (req, res) => {
	res.render('register', { message: false });
});

app.post('/register',  (req, res) => {
	
    const { reg_username, reg_password } = req.body;
	
	connection.query('SELECT * FROM users WHERE username = ?', [reg_username], (err, results) => {
		if (err) {
			console.error('Error querying database: ' + err.stack);
			res.status(500).json({ error: 'Database error' });
			return;
		}
		if (results.length > 0) {
			res.render('register', { message: true });
		} else {
			// Hash the password
			bcrypt.hash(reg_password, saltRounds, (err, hashedPassword) => {
				if (err) {
					console.error('Error hashing password:', err);
					res.status(500).send('Internal Server Error');
					return;
				}	
				const sql = 'INSERT INTO users (username, password) VALUES (?, ?)';
				connection.query(sql,  [reg_username, hashedPassword], (error, result,fields) => {
					if (error) {
						console.error('Error registering user:', error);
						return res.status(500).json({ error: 'Error registering user' });
					} else {
						req.session.loggedIn = true;
						req.session.username = reg_username;
						req.session.uid = result.insertId;
						console.log(`User registered with ID: ${req.session.uid}`);
						res.redirect('/');
					}
				});
			});
		}
	});
});

// Start the server
const port = 3000;
app.listen(port, () => {
	console.log(`Server is running on http://localhost:${port}`);
});