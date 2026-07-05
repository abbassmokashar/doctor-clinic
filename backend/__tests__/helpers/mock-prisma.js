/**
 * Creates a mock Prisma client for controller testing.
 * Each model method returns a jest.fn() that can be customized per test.
 */
function createMockPrisma() {
  const mockModels = {};

  const models = [
    'user', 'doctor', 'patient', 'appointment', 'department',
    'medication', 'setting', 'doctorDepartment', 'medicalRecord',
    'prescription', 'invoice', 'installment', 'medicalTest', 'backup',
  ];

  const methods = ['findUnique', 'findMany', 'findFirst', 'create', 'update', 'delete', 'upsert', 'count'];

  for (const model of models) {
    mockModels[model] = {};
    for (const method of methods) {
      mockModels[model][method] = jest.fn();
    }
  }

  // $transaction can accept either an array of promises or a callback
  mockModels.$transaction = jest.fn((arg) => {
    if (typeof arg === 'function') {
      // Callback form: tx => tx.model.action()
      // Pass a proxy that delegates to the mock models
      return arg(mockModels);
    }
    // Array form: return all promises
    return Promise.all(arg);
  });

  mockModels.$disconnect = jest.fn();

  return mockModels;
}

/**
 * Creates a minimal mock Express response object.
 */
function createMockRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  return res;
}

/**
 * Creates a minimal mock Express request object with optional overrides.
 */
function createMockReq(overrides = {}) {
  return {
    body: {},
    query: {},
    params: {},
    user: { id: 1, email: 'admin@test.com', name: 'Admin', role: 'ADMIN' },
    prisma: createMockPrisma(),
    ...overrides,
  };
}

/**
 * Creates a mock Express next function.
 */
function createMockNext() {
  return jest.fn();
}

module.exports = {
  createMockPrisma,
  createMockRes,
  createMockReq,
  createMockNext,
};
