const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // Create admin user
  const adminPassword = await bcrypt.hash('admin123', 12);
  const admin = await prisma.user.upsert({
    where: { email: 'admin@clinic.com' },
    update: {},
    create: {
      email: 'admin@clinic.com',
      password: adminPassword,
      name: 'Admin',
      role: 'ADMIN',
      phone: '+1-555-0100',
    },
  });
  console.log('Created admin user:', admin.email);

  // Create doctors
  const doctorPassword = await bcrypt.hash('doctor123', 12);
  const doctorsData = [
    { email: 'sarah.johnson@clinic.com', name: 'Dr. Sarah Johnson', specialization: 'Cardiology', licenseNumber: 'LIC-001', bio: 'Experienced cardiologist with 15 years of practice.', consultationFee: 150 },
    { email: 'michael.chen@clinic.com', name: 'Dr. Michael Chen', specialization: 'Pediatrics', licenseNumber: 'LIC-002', bio: 'Pediatrician specializing in child development.', consultationFee: 120 },
    { email: 'emma.rodriguez@clinic.com', name: 'Dr. Emma Rodriguez', specialization: 'Dermatology', licenseNumber: 'LIC-003', bio: 'Board-certified dermatologist.', consultationFee: 130 },
    { email: 'james.wilson@clinic.com', name: 'Dr. James Wilson', specialization: 'Orthopedics', licenseNumber: 'LIC-004', bio: 'Sports medicine and joint replacement specialist.', consultationFee: 160 },
    { email: 'olivia.patel@clinic.com', name: 'Dr. Olivia Patel', specialization: 'Neurology', licenseNumber: 'LIC-005', bio: 'Neurologist focusing on headache disorders.', consultationFee: 170 },
  ];

  const doctors = [];
  for (const docData of doctorsData) {
    const user = await prisma.user.upsert({
      where: { email: docData.email },
      update: {},
      create: {
        email: docData.email,
        password: doctorPassword,
        name: docData.name,
        role: 'DOCTOR',
        phone: `+1-555-01${String(doctorsData.indexOf(docData) + 1).padStart(2, '0')}`,
      },
    });

    const doctor = await prisma.doctor.upsert({
      where: { userId: user.id },
      update: {},
      create: {
        userId: user.id,
        specialization: docData.specialization,
        licenseNumber: docData.licenseNumber,
        bio: docData.bio,
        consultationFee: docData.consultationFee,
      },
    });
    doctors.push(doctor);
    console.log('Created doctor:', user.name);
  }

  // Create receptionist
  const receptionistPassword = await bcrypt.hash('reception123', 12);
  const receptionist = await prisma.user.upsert({
    where: { email: 'reception@clinic.com' },
    update: {},
    create: {
      email: 'reception@clinic.com',
      password: receptionistPassword,
      name: 'Lisa Brown',
      role: 'RECEPTIONIST',
      phone: '+1-555-0106',
    },
  });
  console.log('Created receptionist:', receptionist.email);

  // Create departments
  const departmentsData = [
    { name: 'Cardiology', description: 'Heart and cardiovascular system' },
    { name: 'Pediatrics', description: 'Children\'s health and development' },
    { name: 'Dermatology', description: 'Skin, hair, and nail conditions' },
    { name: 'Orthopedics', description: 'Bones, joints, and muscles' },
    { name: 'Neurology', description: 'Brain and nervous system' },
    { name: 'General Medicine', description: 'General healthcare and checkups' },
  ];

  const departments = [];
  for (const dept of departmentsData) {
    const department = await prisma.department.upsert({
      where: { name: dept.name },
      update: {},
      create: dept,
    });
    departments.push(department);
  }
  console.log('Created departments');

  // Assign doctors to departments
  for (let i = 0; i < doctors.length; i++) {
    await prisma.doctorDepartment.upsert({
      where: { doctorId_departmentId: { doctorId: doctors[i].id, departmentId: departments[i].id } },
      update: {},
      create: { doctorId: doctors[i].id, departmentId: departments[i].id },
    });
  }
  console.log('Assigned doctors to departments');

  // Create schedules for doctors
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  for (const doctor of doctors) {
    for (let day = 1; day <= 5; day++) {
      await prisma.doctorSchedule.upsert({
        where: { doctorId_dayOfWeek: { doctorId: doctor.id, dayOfWeek: day } },
        update: {},
        create: {
          doctorId: doctor.id,
          dayOfWeek: day,
          startTime: '09:00',
          endTime: '17:00',
          isAvailable: true,
        },
      });
    }
    console.log('Created schedule for doctor ID:', doctor.id);
  }

  // Create patients
  const patientsData = [
    { firstName: 'John', lastName: 'Doe', phone: '+1-555-1001', email: 'john.doe@email.com', bloodType: 'A_POSITIVE', allergies: 'Penicillin' },
    { firstName: 'Jane', lastName: 'Smith', phone: '+1-555-1002', email: 'jane.smith@email.com', bloodType: 'O_POSITIVE', allergies: 'None' },
    { firstName: 'Robert', lastName: 'Johnson', phone: '+1-555-1003', email: 'robert.j@email.com', bloodType: 'B_POSITIVE', allergies: 'Sulfa' },
    { firstName: 'Maria', lastName: 'Garcia', phone: '+1-555-1004', email: 'maria.g@email.com', bloodType: 'AB_POSITIVE', allergies: 'Latex' },
    { firstName: 'David', lastName: 'Brown', phone: '+1-555-1005', email: 'david.b@email.com', bloodType: 'A_NEGATIVE', allergies: 'None' },
    { firstName: 'Sarah', lastName: 'Williams', phone: '+1-555-1006', email: 'sarah.w@email.com', bloodType: 'O_NEGATIVE', allergies: 'Peanuts' },
    { firstName: 'James', lastName: 'Taylor', phone: '+1-555-1007', email: 'james.t@email.com', bloodType: 'B_NEGATIVE', allergies: 'None' },
    { firstName: 'Emily', lastName: 'Davis', phone: '+1-555-1008', email: 'emily.d@email.com', bloodType: 'AB_NEGATIVE', allergies: 'Ibuprofen' },
  ];

  const patients = [];
  for (const patData of patientsData) {
    let patient = await prisma.patient.findFirst({
      where: { phone: patData.phone },
    });
    if (!patient) {
      patient = await prisma.patient.create({
        data: {
          ...patData,
          gender: patData.firstName === 'Maria' || patData.firstName === 'Jane' || patData.firstName === 'Sarah' || patData.firstName === 'Emily' ? 'FEMALE' : 'MALE',
          address: `${Math.floor(Math.random() * 999) + 1} Main Street`,
          emergencyContact: `Emergency Contact for ${patData.firstName}`,
          emergencyPhone: '+1-555-9999',
        },
      });
    }
    patients.push(patient);
  }
  console.log('Created patients');

  // Create medications
  const medicationsData = [
    { name: 'Amoxicillin', description: 'Antibiotic for bacterial infections', manufacturer: 'PharmaCorp', dosageForm: 'Capsule', sideEffects: 'Nausea, diarrhea, rash' },
    { name: 'Lisinopril', description: 'ACE inhibitor for hypertension', manufacturer: 'MedHealth', dosageForm: 'Tablet', sideEffects: 'Dizziness, cough, headache' },
    { name: 'Metformin', description: 'First-line medication for type 2 diabetes', manufacturer: 'DiabeCare', dosageForm: 'Tablet', sideEffects: 'Nausea, diarrhea, stomach upset' },
    { name: 'Ibuprofen', description: 'NSAID for pain and inflammation', manufacturer: 'PainRelief Inc', dosageForm: 'Tablet', sideEffects: 'Stomach pain, heartburn' },
    { name: 'Atorvastatin', description: 'Statin for cholesterol management', manufacturer: 'HeartHealth Labs', dosageForm: 'Tablet', sideEffects: 'Muscle pain, joint pain' },
    { name: 'Omeprazole', description: 'Proton pump inhibitor for acid reflux', manufacturer: 'GastroCare', dosageForm: 'Capsule', sideEffects: 'Headache, abdominal pain' },
    { name: 'Sertraline', description: 'SSRI antidepressant', manufacturer: 'NeuroPharm', dosageForm: 'Tablet', sideEffects: 'Nausea, insomnia, drowsiness' },
    { name: 'Albuterol', description: 'Bronchodilator for asthma', manufacturer: 'RespiCare', dosageForm: 'Inhaler', sideEffects: 'Tremor, nervousness, headache' },
  ];

  for (const med of medicationsData) {
    await prisma.medication.upsert({
      where: { name: med.name },
      update: {},
      create: med,
    });
  }
  console.log('Created medications');

  // Create sample appointments
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const appointmentTimes = ['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'];

  for (let i = 0; i < 6; i++) {
    const [hours, minutes] = appointmentTimes[i].split(':');
    const apptDate = new Date(today);
    apptDate.setHours(parseInt(hours), parseInt(minutes), 0, 0);

    if (apptDate < today && i < 3) continue;

    const apptDateTime = apptDate > today ? apptDate : new Date(tomorrow.setHours(parseInt(hours), parseInt(minutes), 0, 0));
    
    // Use a unique combination for upsert
    const existingAppt = await prisma.appointment.findFirst({
      where: {
        doctorId: doctors[i % doctors.length].id,
        patientId: patients[i].id,
        dateTime: apptDateTime,
      },
    });

    if (!existingAppt) {
      await prisma.appointment.create({
        data: {
          doctorId: doctors[i % doctors.length].id,
          patientId: patients[i].id,
          dateTime: apptDateTime,
          duration: 30,
          reason: ['Annual checkup', 'Follow-up visit', 'Consultation', 'Test results review', 'Vaccination', 'General pain'][i],
          status: i < 3 ? 'COMPLETED' : 'SCHEDULED',
        },
      });
    }
  }
  console.log('Created sample appointments');

  // Create sample invoices
  const appointments = await prisma.appointment.findMany({ take: 3 });
  for (const appt of appointments) {
    const doctor = doctors.find(d => d.id === appt.doctorId);
    await prisma.invoice.upsert({
      where: { appointmentId: appt.id },
      update: {},
      create: {
        patientId: appt.patientId,
        appointmentId: appt.id,
        amount: doctor ? doctor.consultationFee : 100,
        description: `Consultation fee - ${appt.reason}`,
        status: 'PENDING',
        dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    });
  }
  console.log('Created sample invoices');

  // Create an installment plan invoice
  const installmentPatient = patients[3]; // Maria Garcia
  const installmentBaseDate = new Date();
  installmentBaseDate.setMonth(installmentBaseDate.getMonth() + 1);

  const installmentInvoice = await prisma.invoice.create({
    data: {
      patientId: installmentPatient.id,
      amount: 600,
      description: 'Dental treatment plan - crowns and cleaning',
      status: 'PARTIALLY_PAID',
      isInstallment: true,
      totalInstallments: 3,
      dueDate: installmentBaseDate,
      paidAmount: 200,
    },
  });

  // Create installments for it
  await prisma.installment.createMany({
    data: [
      {
        invoiceId: installmentInvoice.id,
        amount: 200,
        dueDate: new Date(installmentBaseDate),
        status: 'PAID',
        paidAmount: 200,
        paidAt: new Date(),
        orderIndex: 1,
        notes: 'Installment 1 of 3',
      },
      {
        invoiceId: installmentInvoice.id,
        amount: 200,
        dueDate: new Date(installmentBaseDate.getFullYear(), installmentBaseDate.getMonth() + 1, installmentBaseDate.getDate()),
        status: 'PENDING',
        orderIndex: 2,
        notes: 'Installment 2 of 3',
      },
      {
        invoiceId: installmentInvoice.id,
        amount: 200,
        dueDate: new Date(installmentBaseDate.getFullYear(), installmentBaseDate.getMonth() + 2, installmentBaseDate.getDate()),
        status: 'PENDING',
        orderIndex: 3,
        notes: 'Installment 3 of 3',
      },
    ],
  });
  console.log('Created sample installment plan invoice');

  console.log('\n✅ Seeding completed successfully!');
  console.log('\nLogin Credentials:');
  console.log('  Admin:        admin@clinic.com / admin123');
  console.log('  Receptionist: reception@clinic.com / reception123');
  console.log('  Doctor:       sarah.johnson@clinic.com / doctor123');
  console.log('  (All doctors use: doctor123)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
