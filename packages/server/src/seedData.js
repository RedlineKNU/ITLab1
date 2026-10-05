const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==',
  'base64'
);

export const DEMO_USERS = [
  { login: 'alice', password: 'alice123' },
  { login: 'bob', password: 'bob123' },
];

export const DEMO_FILES = [
  {
    name: 'readme.cpp',
    content: Buffer.from(
      `#include <iostream>\nint main() {\n  std::cout << "Привіт із Mini Drive" << std::endl;\n  return 0;\n}\n`,
      'utf8'
    ),
    uploader: 'alice',
    modifier: 'alice',
  },
  {
    name: 'notes.txt',
    content: Buffer.from('Текстова нотатка демо-користувача.\n', 'utf8'),
    uploader: 'alice',
    modifier: 'alice',
  },
  {
    name: 'index.html',
    content: Buffer.from(
      `<!doctype html>\n<html>\n  <head><title>Hello</title></head>\n  <body>\n    <h1>Привіт</h1>\n    <p>Файл index.html має показуватись як <strong>сирий текст</strong>.</p>\n  </body>\n</html>\n`,
      'utf8'
    ),
    uploader: 'alice',
    modifier: 'bob',
  },
  { name: 'logo.png', content: PNG_BYTES, uploader: 'bob', modifier: 'bob' },
  { name: 'SCREEN.PNG', content: PNG_BYTES, uploader: 'bob', modifier: 'alice' },
  {
    name: 'util.js',
    content: Buffer.from(`export const greet = (name) => 'Привіт, ' + name;\n`, 'utf8'),
    uploader: 'bob',
    modifier: 'bob',
  },
];

export async function seedDemoData({ authService, fileService, fileRepository, userRepository }) {
  const createdUsers = {};
  for (const u of DEMO_USERS) {
    const existing = userRepository.findByLogin(u.login);
    createdUsers[u.login] = existing
      ? existing
      : await authService.register(u);
  }

  // All demo files owned by alice so one login shows uploader/modifier variety.
  for (const file of DEMO_FILES) {
    const saved = await fileService.save({
      ownerId: createdUsers.alice.id,
      ownerLogin: file.uploader,
      name: file.name,
      buffer: file.content,
    });
    if (file.modifier !== file.uploader) {
      fileRepository.update(saved.id, {
        modifiedAt: new Date().toISOString(),
        modifiedBy: file.modifier,
      });
    }
  }

  return { users: Object.values(createdUsers), fileCount: DEMO_FILES.length };
}
