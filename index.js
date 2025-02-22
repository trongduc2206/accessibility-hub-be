require('dotenv').config()

const { Pool } = require('pg')
const pool = new Pool({
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    database: process.env.DB_DATABASE,
    ssl: {
        rejectUnauthorized: false, // May need to be `true` in production
    }
})
// client.connect().then(() => {console.log("connect to database")}).catch((error) => {console.log(error)})
pool.connect((err) => {
    if (err) {
        console.log(err);
        return;
    }
    console.log('connected to database');
});
const express = require('express')
const app = express()
const cors = require('cors')
app.use(cors())
app.use(express.json())

app.get('/', (request, response) => {
    response.send('<h1>Welcome to Accessibility Hub APIs!</h1>')
})

app.get('/rules-test', (request, response) => {
    const rules = "html-has-lang"
    response.send(rules)
})

app.get('/rules/:id', (request, response) => {
    pool.query(`SELECT * FROM service_rules WHERE service_id='${request.params.id}' `, (error, results) => {
        if (error) {
            throw error
        }
        if (results.rows && results.rows.length > 0) {
            const rule = results.rows[0]
            response.send(rule.rule_ids)
        } else {
            response.status(404).send();
        }
    })
})

app.post('/rules', (request, response) => {
    console.log(request.body)
    const {
        serviceId,
        ruleIds
    } = request.body

    pool.query('INSERT INTO service_rules (service_id, rule_ids) VALUES ($1, $2) RETURNING *', [serviceId, ruleIds], (error, results) => {
        if (error) {
            throw error
        }
        console.log(results.rows[0])
        response.status(201).send(`${results.rows[0].service_id}`)
    })
})

app.put('/rules/:id', (request, response) => {
    console.log(request.body)
    const {
        ruleIds
    } = request.body

    pool.query('UPDATE service_rules SET rule_ids=$2 WHERE service_id=$1 RETURNING *', [request.params.id, ruleIds], (error, results) => {
        if (error) {
            throw error
        }
        console.log(results.rows[0])
        response.status(200).send(`${results.rows[0].service_id}`)
    })
})

app.delete('/rules/:id', (request, response) => {
    pool.query('DELETE FROM service_rules WHERE service_id=$1 RETURNING *', [request.params.id], (error, results) => {
        if (error) {
            throw error
        }
        response.status(200).send(`${request.params.id}`)
    })
})

app.post('/extract-rule-ids', (request, response) => {
    const { output, serviceId } = request.body;

    if (!output || !serviceId) {
        return response.status(400).send('No output or service_id provided');
    }

    const ruleIds = [];
    const regex = /Violation of "([^"]+)"/g;
    let match;

    while ((match = regex.exec(output)) !== null) {
        ruleIds.push(match[1]);
    }

    const ruleIdsString = ruleIds.join(',');

    pool.query('UPDATE service_rules SET manual_failed_rule_ids=$2 WHERE service_id=$1 RETURNING *', [serviceId, ruleIdsString], (error, results) => {
        if (error) {
            throw error
        }
        response.status(200).json({ service_id: results.rows[0].service_id, manual_failed_rule_ids: results.rows[0].manual_failed_rule_ids });
    })
})

app.get('/manual-failed-rule-ids/:id', (request, response) => {
  const serviceId = request.params.id;

  pool.query('SELECT manual_failed_rule_ids FROM service_rules WHERE service_id=$1', [serviceId], (error, results) => {
      if (error) {
          throw error
      }
      if (results.rows && results.rows.length > 0) {
          const ruleIdsString = results.rows[0].manual_failed_rule_ids;
          const ruleIdsArray = ruleIdsString ? ruleIdsString.split(',') : [];
          response.status(200).json({ service_id: serviceId, manual_failed_rule_ids: ruleIdsArray });
      } else {
          response.status(404).send('Service ID not found');
      }
  })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})