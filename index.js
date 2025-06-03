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

const { OpenAI } = require("openai");

const openaiClient = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get('/', (request, response) => {
    response.send('<h1>Welcome to Accessibility Hub APIs!</h1>')
})

app.get('/rules-test', (request, response) => {
    const rules = "html-has-lang"
    response.send(rules)
})

app.post('/service-id', (request, response) => {
  const { serviceName }  = request.body;
  pool.query('SELECT service_id FROM service_rules WHERE service_name=$1', [serviceName], (error, results) => {
      if (error) {
          throw error
      }
      if (results.rows && results.rows.length > 0) {
          response.status(200).json({ service_id: results.rows[0].service_id });
      } else {
          response.status(404).send('Service name not found');
      }
  })
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

app.get('/ignore-pa11y-rules/:id', (request, response) => {
    pool.query(`SELECT ignore_pa11y_rule_ids FROM service_rules WHERE service_id='${request.params.id}' `, (error, results) => {
        if (error) {
            throw error
        }
        if (results.rows && results.rows.length > 0) {
            const ignoredRules = results.rows[0]
            response.send(ignoredRules.ignore_pa11y_rule_ids)
        } else {
            response.status(404).send();
        }
    })
})

app.post('/rules', (request, response) => {
    console.log(request.body)
    const {
        serviceName,
        ruleIds
    } = request.body

    const serviceId = serviceName.toLowerCase().replace(/\s+/g, '') + Math.floor(10000 + Math.random() * 90000);
    console.log('serviceId:', serviceId);

    pool.query('INSERT INTO service_rules (service_name, service_id, rule_ids) VALUES ($1, $2, $3) RETURNING *', [serviceName, serviceId, ruleIds], (error, results) => {
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

app.put('/ignore-pa11y-rules/:id', (request, response) => {
    console.log(request.body)
    const {
        ruleIds
    } = request.body

    pool.query('UPDATE service_rules SET ignore_pa11y_rule_ids=$2 WHERE service_id=$1 RETURNING *', [request.params.id, ruleIds], (error, results) => {
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

app.post('/extract-rule-codes', (request, response) => {
    const { output, serviceId } = request.body;

    if (!output || !serviceId) {
        return response.status(400).send('No output or service_id provided');
    }

    const ruleCodes = [];
    const regex = /├── (WCAG2AA\.[^\s]+)/g; // Regex to match rule codes
    let match;

    while ((match = regex.exec(output)) !== null) {
        ruleCodes.push(match[1]);
    }
    const uniqueRuleCodes = [...new Set(ruleCodes)];
    console.log('uniqueRuleCodes:', uniqueRuleCodes);

    const ruleCodesString = uniqueRuleCodes.join(',');

    pool.query('UPDATE service_rules SET manual_failed_rule_ids_pa11y=$2 WHERE service_id=$1 RETURNING *', [serviceId, ruleCodesString], (error, results) => {
        if (error) {
            throw error
        }
        response.status(200).json({ service_id: results.rows[0].service_id, manual_failed_rule_codes: results.rows[0].manual_failed_rule_ids_pa11y });
    })
});

app.post('/axe-full-manual', (request, response) => {
    const { output, serviceId } = request.body;

    if (!output || !serviceId) {
        return response.status(400).send('No output or service_id provided');
    }

    pool.query('UPDATE service_rules SET axe_full_manual_result=$2 WHERE service_id=$1 RETURNING *', [serviceId, output], (error, results) => {
        if (error) {
            throw error
        }
        response.status(200).json({ service_id: results.rows[0].service_id });
    })
})


app.get('/manual-failed-rule-ids/:id', (request, response) => {
  const serviceId = request.params.id;

  pool.query('SELECT manual_failed_rule_ids, manual_failed_rule_ids_pa11y  FROM service_rules WHERE service_id=$1', [serviceId], (error, results) => {
      if (error) {
          throw error
      }
      if (results.rows && results.rows.length > 0) {
          const ruleIdsString = results.rows[0].manual_failed_rule_ids;
          const ruleIdsArray = ruleIdsString ? ruleIdsString.split(',') : [];
          const ruleCodesString = results.rows[0].manual_failed_rule_ids_pa11y;
          const ruleCodesArray = ruleCodesString ? ruleCodesString.split(',') : [];
          response.status(200).json({ service_id: serviceId, manual_failed_rule_ids: ruleIdsArray, manual_failed_rule_ids_pa11y: ruleCodesArray });
      } else {
          response.status(404).send('Service ID not found');
      }
  })
})

app.get('/axe-full-manual/:id', (request, response) => {
  const serviceId = request.params.id;
    pool.query('SELECT axe_full_manual_result FROM service_rules WHERE service_id=$1', [serviceId], (error, results) => {
        if (error) {
            throw error
        }
        if (results.rows && results.rows.length > 0) {
            const axeFullManualResult = results.rows[0].axe_full_manual_result;
            response.status(200).json({ service_id: serviceId, axe_full_manual_result: axeFullManualResult });
        } else {
            response.status(404).send('Service ID not found');
        }
    })
})

app.get('/axe-instruction/:id', async (request, response) => {
    const serviceId = request.params.id;
    pool.query('SELECT axe_full_manual_result FROM service_rules WHERE service_id=$1', [serviceId], async (error, results) => {
        if (error) {
            throw error
        }
        if (results.rows && results.rows.length > 0) {
            const axeFullManualResult = results.rows[0].axe_full_manual_result;
             const instruction = await openaiClient.responses.create({
                model: "gpt-4o-mini",
                instructions: "Talk like a web accessibility expert.",
                input: `How to fix the accessibility issues from this evaluation result: ${axeFullManualResult}?`,
            });
            console.log("Response:", instruction);
            response.status(200).json({ service_id: serviceId, instruction: instruction.output_text });
        } else {
            response.status(404).send('Service ID not found');
        }
    })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})