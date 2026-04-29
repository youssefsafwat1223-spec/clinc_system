const prisma = require('../lib/prisma');

const list = async (req, res, next) => {
  try {
    const contacts = await prisma.directContact.findMany({
      orderBy: [{ active: 'desc' }, { priority: 'desc' }, { name: 'asc' }],
    });

    res.json({ contacts });
  } catch (error) {
    next(error);
  }
};

const create = async (req, res, next) => {
  try {
    const { name, phone, description, priority = 0, active = true } = req.body;

    if (!String(name || '').trim() || !String(phone || '').trim()) {
      return res.status(400).json({ error: 'الاسم ورقم الهاتف مطلوبان' });
    }

    const contact = await prisma.directContact.create({
      data: {
        name: String(name).trim(),
        phone: String(phone).trim(),
        description: description || null,
        priority: Number(priority) || 0,
        active: Boolean(active),
      },
    });

    res.status(201).json({ contact });
  } catch (error) {
    next(error);
  }
};

const update = async (req, res, next) => {
  try {
    const { name, phone, description, priority, active } = req.body;

    const contact = await prisma.directContact.update({
      where: { id: req.params.id },
      data: {
        ...(name !== undefined && { name: String(name).trim() }),
        ...(phone !== undefined && { phone: String(phone).trim() }),
        ...(description !== undefined && { description: description || null }),
        ...(priority !== undefined && { priority: Number(priority) || 0 }),
        ...(active !== undefined && { active: Boolean(active) }),
      },
    });

    res.json({ contact });
  } catch (error) {
    next(error);
  }
};

const remove = async (req, res, next) => {
  try {
    await prisma.directContact.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

module.exports = { list, create, update, remove };
