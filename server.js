require('dotenv').config();

const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { createClient } = require('@supabase/supabase-js');
const { verificarToken } = require('./middleware');

const app = express();
const PORT = process.env.PORT || 3000;

// ===== SUPABASE =====
const sb = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

// ===== MIDDLEWARES GLOBALES =====
app.use(express.json());
app.use(express.static('public')); // Sirve index.html, styles.css, app.js

// ===== RUTAS DE AUTENTICACIÓN =====

// POST /api/registro
app.post('/api/registro', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Completa todos los campos.' });
  }
  if (username.length < 4) {
    return res.status(400).json({ error: 'El usuario debe tener al menos 4 caracteres.' });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres.' });
  }

  try {
    // Verificar si el usuario ya existe
    const { data: existente } = await sb
      .from('usuarios')
      .select('username')
      .eq('username', username)
      .single();

    if (existente) {
      return res.status(409).json({ error: 'Ese nombre de usuario ya existe.' });
    }

    // Hashear contraseña con bcrypt
    const hashPass = await bcrypt.hash(password, 10);

    const { error } = await sb
      .from('usuarios')
      .insert([{ username, password: hashPass }]);

    if (error) {
      return res.status(500).json({ error: 'Error al registrar: ' + error.message });
    }

    res.status(201).json({ mensaje: '¡Cuenta creada exitosamente!' });
  } catch (e) {
    res.status(500).json({ error: 'Error del servidor: ' + e.message });
  }
});

// POST /api/login
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Completa todos los campos.' });
  }

  try {
    const { data: usuario, error } = await sb
      .from('usuarios')
      .select('username, password')
      .eq('username', username)
      .single();

    if (error || !usuario) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Comparar contraseña con bcrypt
    const valida = await bcrypt.compare(password, usuario.password);
    if (!valida) {
      return res.status(401).json({ error: 'Credenciales inválidas.' });
    }

    // Generar token JWT (expira en 7 días)
    const token = jwt.sign(
      { username: usuario.username },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({ token, username: usuario.username });
  } catch (e) {
    res.status(500).json({ error: 'Error del servidor: ' + e.message });
  }
});



// ===== INICIAR SERVIDOR =====
app.listen(PORT, () => {
  console.log('FritoMapp corriendo en http://localhost:' + PORT);
});