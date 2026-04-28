const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function createSuperAdmin() {
  try {
    const email = 'apeskov635@gmail.com';
    const password = 'bloknot_admin_2024';
    
    console.log('🔍 Проверяю существование супер админа...');
    
    // Проверяем существует ли пользователь
    let user = await prisma.user.findUnique({
      where: { email }
    });
    
    if (user) {
      console.log('✅ Пользователь найден, обновляю пароль и роль...');
      
      // Хешируем пароль
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Обновляем пользователя
      user = await prisma.user.update({
        where: { email },
        data: {
          password: hashedPassword,
          role: 'SUPER_ADMIN'
        }
      });
      
      console.log('✅ Пользователь обновлен:', { id: user.id, email: user.email, role: user.role });
    } else {
      console.log('❌ Пользователь не найден, создаю нового...');
      
      // Хешируем пароль
      const hashedPassword = await bcrypt.hash(password, 10);
      
      // Создаем нового супер админа
      user = await prisma.user.create({
        data: {
          email,
          password: hashedPassword,
          role: 'SUPER_ADMIN',
          isPaying: false,
          totalPaid: 0
        }
      });
      
      console.log('✅ Супер админ создан:', { id: user.id, email: user.email, role: user.role });
    }
    
    // Проверяем что пользователь может быть найден
    const verifyUser = await prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, role: true, hasPassword: true }
    });
    
    console.log('🔍 Верификация пользователя:', verifyUser);
    
    // Тестируем пароль
    const isValid = await bcrypt.compare(password, user.password);
    console.log('🔍 Проверка пароля:', isValid ? '✅ Верный' : '❌ Неверный');
    
  } catch (error) {
    console.error('❌ Ошибка:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createSuperAdmin();
