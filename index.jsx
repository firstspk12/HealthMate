import React, { useState, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, onSnapshot, collection, query, addDoc, getDocs } from 'firebase/firestore';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';

// Context for Firebase and User data
const AppContext = createContext(null);

// Custom hook to use app context
const useAppContext = () => useContext(AppContext);

// Firebase configuration and initialization
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-health-app';
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Nutritional guidelines (example values, can be adjusted)
const DAILY_NUTRIENT_LIMITS = {
  calories: 2000,
  carbohydrates: 250,
  sugars: 50,
  fiber: 30,
  protein: 75,
  totalFat: 60,
  saturatedFat: 20,
  unsaturatedFat: 40,
  cholesterol: 300,
  sodium: 2300,
  potassium: 4700,
  calcium: 1000,
  magnesium: 400,
};

// Helper function to format date to YYYY-MM-DD
const formatDate = (date) => {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// Reusable Message Alert Component
const MessageAlert = ({ message, type = 'info' }) => {
  let bgColor, borderColor, textColor;
  switch (type) {
    case 'success':
      bgColor = 'bg-green-100';
      borderColor = 'border-green-400';
      textColor = 'text-green-700';
      break;
    case 'error':
      bgColor = 'bg-red-100';
      borderColor = 'border-red-400';
      textColor = 'text-red-700';
      break;
    case 'warning':
      bgColor = 'bg-yellow-100';
      borderColor = 'border-yellow-400';
      textColor = 'text-yellow-700';
      break;
    default: // info
      bgColor = 'bg-blue-100';
      borderColor = 'border-blue-400';
      textColor = 'text-blue-700';
  }

  return (
    <div className={`${bgColor} ${borderColor} ${textColor} px-4 py-3 rounded-lg relative mb-4 shadow-sm`} role="alert">
      <span className="block sm:inline">{message}</span>
    </div>
  );
};

// Reusable Custom Modal Component
const CustomModal = ({ title, children, onClose, isOpen }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 flex items-center justify-center p-4 z-50 animate-fade-in">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md transform scale-95 animate-scale-in">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-semibold text-blue-700">{title}</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl leading-none"
            aria-label="ปิด"
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
};

// Main App Component
const App = () => {
  const [db, setDb] = useState(null);
  const [auth, setAuth] = useState(null);
  const [userId, setUserId] = useState(null);
  const [currentPage, setCurrentPage] = useState('profile'); // 'profile', 'bloodTest', 'foodTracking', 'history'
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [isPremium, setIsPremium] = useState(false); // Simulate premium status

  useEffect(() => {
    const app = initializeApp(firebaseConfig);
    const firestore = getFirestore(app);
    const firebaseAuth = getAuth(app);

    setDb(firestore);
    setAuth(firebaseAuth);

    const unsubscribe = onAuthStateChanged(firebaseAuth, async (user) => {
      if (user) {
        setUserId(user.uid);
      } else {
        // Sign in anonymously if no token is provided or user is not logged in
        if (initialAuthToken) {
          try {
            await signInWithCustomToken(firebaseAuth, initialAuthToken);
            setUserId(firebaseAuth.currentUser.uid);
          } catch (error) {
            console.error("Error signing in with custom token:", error);
            await signInAnonymously(firebaseAuth);
            setUserId(firebaseAuth.currentUser.uid);
          }
        } else {
          await signInAnonymously(firebaseAuth);
          setUserId(firebaseAuth.currentUser.uid);
        }
      }
      setIsAuthReady(true);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, []);

  if (isLoading || !isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-100 p-4">
        <div className="text-center text-gray-700">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-lg">กำลังโหลดแอปพลิเคชัน...</p>
        </div>
      </div>
    );
  }

  return (
    <AppContext.Provider value={{ db, auth, userId, appId, isPremium, setIsPremium }}>
      <div className="min-h-screen bg-gray-100 font-inter text-gray-800 flex flex-col">
        {/* Header */}
        <header className="bg-gradient-to-r from-blue-600 to-purple-700 text-white p-4 shadow-lg flex justify-between items-center rounded-b-xl">
          <h1 className="text-3xl font-bold">Health Tracker</h1>
          <div className="text-sm text-right">
            {userId && <span className="block opacity-80">User ID: {userId.substring(0, 8)}...</span>}
            {isPremium ? <span className="text-yellow-300 font-semibold">Premium User</span> : <span className="text-gray-200">Free User</span>}
          </div>
        </header>

        {/* Navigation */}
        <nav className="bg-white shadow-md p-3 flex justify-around rounded-t-xl mx-2 mt-2">
          <NavLink
            label="โปรไฟล์"
            isActive={currentPage === 'profile'}
            onClick={() => setCurrentPage('profile')}
          />
          <NavLink
            label="ผลเลือด"
            isActive={currentPage === 'bloodTest'}
            onClick={() => setCurrentPage('bloodTest')}
          />
          <NavLink
            label="ติดตามอาหาร"
            isActive={currentPage === 'foodTracking'}
            onClick={() => setCurrentPage('foodTracking')}
          />
          <NavLink
            label="ประวัติ"
            isActive={currentPage === 'history'}
            onClick={() => setCurrentPage('history')}
          />
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 p-4 overflow-y-auto">
          {currentPage === 'profile' && <ProfilePage />}
          {currentPage === 'bloodTest' && <BloodTestPage />}
          {currentPage === 'foodTracking' && <FoodTrackingPage />}
          {currentPage === 'history' && <HistoryPage />}
        </main>

        {/* Footer for Premium */}
        {!isPremium && (
          <footer className="bg-gradient-to-r from-green-500 to-teal-600 text-white p-4 text-center rounded-t-xl mx-2 mb-2 shadow-lg">
            <p className="mb-2 text-lg font-medium">ปลดล็อกเมนูและคุณสมบัติเพิ่มเติม!</p>
            <button
              onClick={() => setIsPremium(true)}
              className="bg-white text-green-700 font-bold py-2 px-6 rounded-full shadow-md hover:bg-gray-100 transition-transform transform hover:scale-105"
            >
              อัปเกรดเป็น Premium
            </button>
          </footer>
        )}
      </div>
    </AppContext.Provider>
  );
};

// NavLink Component
const NavLink = ({ label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex-1 py-2 px-4 text-center rounded-lg transition-all duration-300 mx-1
      ${isActive ? 'bg-blue-600 text-white shadow-md transform scale-105' : 'text-gray-700 hover:bg-gray-100 hover:text-blue-600'}`
    }
  >
    {label}
  </button>
);

// Profile Page Component
const ProfilePage = () => {
  const { db, userId, appId } = useAppContext();
  const [profile, setProfile] = useState({ height: '', weight: '', gender: '' });
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!db || !userId) return;

    const docRef = doc(db, `artifacts/${appId}/users/${userId}/profile`, 'userProfile');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setProfile(docSnap.data());
        setIsEditing(false); // Set to false if profile exists
      } else {
        setProfile({ height: '', weight: '', gender: '' }); // Reset if no profile
        setIsEditing(true); // Allow editing if no profile exists
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching profile:", error);
      setMessage("เกิดข้อผิดพลาดในการโหลดโปรไฟล์");
      setMessageType('error');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, userId, appId]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!db || !userId) {
      setMessage("ไม่สามารถบันทึกได้: ผู้ใช้ไม่ได้เข้าสู่ระบบ");
      setMessageType('error');
      return;
    }
    if (!profile.height || !profile.weight || !profile.gender) {
        setMessage("กรุณากรอกข้อมูลส่วนสูง น้ำหนัก และเพศให้ครบถ้วน");
        setMessageType('warning');
        return;
    }

    try {
      const docRef = doc(db, `artifacts/${appId}/users/${userId}/profile`, 'userProfile');
      await setDoc(docRef, profile, { merge: true });
      setMessage("บันทึกโปรไฟล์เรียบร้อยแล้ว!");
      setMessageType('success');
      setIsEditing(false);
    } catch (error) {
      console.error("Error saving profile:", error);
      setMessage("เกิดข้อผิดพลาดในการบันทึกโปรไฟล์");
      setMessageType('error');
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        <p className="ml-3 text-blue-600">กำลังโหลดโปรไฟล์...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-2xl font-semibold mb-6 text-center text-blue-700">ข้อมูลโปรไฟล์ส่วนตัว</h2>
      {message && <MessageAlert message={message} type={messageType} />}

      {!isEditing && profile.height && profile.weight && profile.gender ? (
        <div className="text-lg text-gray-700 space-y-3">
          <p><span className="font-medium text-blue-800">ส่วนสูง:</span> {profile.height} ซม.</p>
          <p><span className="font-medium text-blue-800">น้ำหนัก:</span> {profile.weight} กก.</p>
          <p><span className="font-medium text-blue-800">เพศ:</span> {profile.gender === 'male' ? 'ชาย' : 'หญิง'}</p>
          <button
            onClick={() => setIsEditing(true)}
            className="w-full mt-6 bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105"
          >
            แก้ไขโปรไฟล์
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="height" className="block text-sm font-medium text-gray-700 mb-1">
              ส่วนสูง (ซม.): <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="height"
              name="height"
              value={profile.height}
              onChange={handleChange}
              placeholder="เช่น 170"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-200"
            />
          </div>
          <div>
            <label htmlFor="weight" className="block text-sm font-medium text-gray-700 mb-1">
              น้ำหนัก (กก.): <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              id="weight"
              name="weight"
              value={profile.weight}
              onChange={handleChange}
              placeholder="เช่น 65"
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-200"
            />
          </div>
          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
              เพศ: <span className="text-red-500">*</span>
            </label>
            <select
              id="gender"
              name="gender"
              value={profile.gender}
              onChange={handleChange}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-200"
            >
              <option value="">เลือกเพศ</option>
              <option value="male">ชาย</option>
              <option value="female">หญิง</option>
            </select>
          </div>
          <button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105"
          >
            บันทึกโปรไฟล์
          </button>
        </form>
      )}
    </div>
  );
};

// Blood Test Page Component
const BloodTestPage = () => {
  const { db, userId, appId } = useAppContext();
  const [bloodTests, setBloodTests] = useState({});
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const bloodTestFields = [
    { id: 'fbs', label: 'Fasting Blood Sugar (FBS)', unit: 'mg/dL', group: 'น้ำตาลในเลือด' },
    { id: 'hba1c', label: 'HbA1c', unit: '%', group: 'น้ำตาลในเลือด' },
    { id: 'rbs', label: 'Random Blood Sugar (RBS)', unit: 'mg/dL', group: 'น้ำตาลในเลือด' },
    { id: 'totalCholesterol', label: 'Cholesterol รวม (Total Cholesterol)', unit: 'mg/dL', group: 'ไขมันในเลือด' },
    { id: 'ldl', label: 'LDL', unit: 'mg/dL', group: 'ไขมันในเลือด' },
    { id: 'hdl', label: 'HDL', unit: 'mg/dL', group: 'ไขมันในเลือด' },
    { id: 'triglycerides', label: 'Triglycerides', unit: 'mg/dL', group: 'ไขมันในเลือด' },
    { id: 'creatinine', label: 'Creatinine', unit: 'mg/dL', group: 'การทำงานของไต' },
    { id: 'egfr', label: 'eGFR', unit: 'mL/min/1.73m²', group: 'การทำงานของไต' },
    { id: 'microalbuminuria', label: 'Microalbuminuria / Albumin-to-Creatinine Ratio', unit: 'mg/g', group: 'การทำงานของไต' },
    { id: 'systolicBp', label: 'ความดันโลหิต (Systolic)', unit: 'mmHg', group: 'ความดันโลหิต' },
    { id: 'diastolicBp', label: 'ความดันโลหิต (Diastolic)', unit: 'mmHg', group: 'ความดันโลหิต' },
    { id: 'potassium', label: 'Potassium', unit: 'mmol/L', group: 'เกลือแร่ในเลือด' },
    { id: 'sodium', label: 'Sodium', unit: 'mmol/L', group: 'เกลือแร่ในเลือด' },
    { id: 'uricAcid', label: 'Uric Acid', unit: 'mg/dL', group: 'อื่นๆ' },
    { id: 'hscrp', label: 'hs-CRP (optional)', unit: 'mg/L', group: 'อื่นๆ' },
    { id: 'troponin', label: 'Troponin (optional)', unit: 'ng/mL', group: 'อื่นๆ' },
  ];

  const groupedFields = bloodTestFields.reduce((acc, field) => {
    (acc[field.group] = acc[field.group] || []).push(field);
    return acc;
  }, {});

  useEffect(() => {
    if (!db || !userId) return;

    const docRef = doc(db, `artifacts/${appId}/users/${userId}/bloodTests`, selectedDate);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setBloodTests(docSnap.data());
      } else {
        setBloodTests({}); // Reset if no data for the selected date
      }
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching blood tests:", error);
      setMessage("เกิดข้อผิดพลาดในการโหลดผลเลือด");
      setMessageType('error');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, userId, appId, selectedDate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setBloodTests(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!db || !userId) {
      setMessage("ไม่สามารถบันทึกได้: ผู้ใช้ไม่ได้เข้าสู่ระบบ");
      setMessageType('error');
      return;
    }

    try {
      const docRef = doc(db, `artifacts/${appId}/users/${userId}/bloodTests`, selectedDate);
      await setDoc(docRef, bloodTests, { merge: true });
      setMessage("บันทึกผลเลือดเรียบร้อยแล้ว!");
      setMessageType('success');
    } catch (error) {
      console.error("Error saving blood tests:", error);
      setMessage("เกิดข้อผิดพลาดในการบันทึกผลเลือด");
      setMessageType('error');
    }
  };

  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setIsAnalyzing(true);
    setMessage('กำลังวิเคราะห์ผลเลือดจากรูปภาพ...');
    setMessageType('info');

    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64ImageData = reader.result.split(',')[1]; // Get base64 string without data:image/png;base64,

      const prompt = `
        โปรดวิเคราะห์รูปภาพผลเลือดนี้และดึงค่าการตรวจเลือดต่อไปนี้ออกมาในรูปแบบ JSON Object:
        - Fasting Blood Sugar (FBS)
        - HbA1c
        - Random Blood Sugar (RBS)
        - Creatinine
        - eGFR
        - Microalbuminuria / Albumin-to-Creatinine Ratio
        - Cholesterol รวม (Total Cholesterol)
        - LDL
        - HDL
        - Triglycerides
        - Systolic Blood Pressure (ความดันโลหิต Systolic)
        - Diastolic Blood Pressure (ความดันโลหิต Diastolic)
        - Potassium
        - Sodium
        - Uric Acid
        - hs-CRP
        - Troponin

        สำหรับแต่ละค่า ให้ระบุเฉพาะตัวเลขเท่านั้น (ไม่รวมหน่วย) หากไม่พบค่าใดๆ ให้ระบุเป็น null
        ตัวอย่างรูปแบบ JSON:
        {
          "fbs": 95,
          "hba1c": 6.2,
          "rbs": null,
          "creatinine": 0.8,
          "egfr": 90,
          "microalbuminuria": null,
          "totalCholesterol": 180,
          "ldl": 100,
          "hdl": 50,
          "triglycerides": 120,
          "systolicBp": 120,
          "diastolicBp": 80,
          "potassium": 4.0,
          "sodium": 140,
          "uricAcid": 5.5,
          "hscrp": null,
          "troponin": null
        }
      `;

      try {
        const chatHistory = [];
        chatHistory.push({ role: "user", parts: [{ text: prompt }] });
        const payload = {
            contents: [
                {
                    role: "user",
                    parts: [
                        { text: prompt },
                        {
                            inlineData: {
                                mimeType: file.type, // Use the actual mime type of the uploaded file
                                data: base64ImageData
                            }
                        }
                    ]
                }
            ],
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        "fbs": { "type": ["number", "null"] },
                        "hba1c": { "type": ["number", "null"] },
                        "rbs": { "type": ["number", "null"] },
                        "creatinine": { "type": ["number", "null"] },
                        "egfr": { "type": ["number", "null"] },
                        "microalbuminuria": { "type": ["number", "null"] },
                        "totalCholesterol": { "type": ["number", "null"] },
                        "ldl": { "type": ["number", "null"] },
                        "hdl": { "type": ["number", "null"] },
                        "triglycerides": { "type": ["number", "null"] },
                        "systolicBp": { "type": ["number", "null"] },
                        "diastolicBp": { "type": ["number", "null"] },
                        "potassium": { "type": ["number", "null"] },
                        "sodium": { "type": ["number", "null"] },
                        "uricAcid": { "type": ["number", "null"] },
                        "hscrp": { "type": ["number", "null"] },
                        "troponin": { "type": ["number", "null"] }
                    }
                }
            }
        };

        const apiKey = ""; // Canvas will provide this
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
        const response = await fetch(apiUrl, {
                   method: 'POST',
                   headers: { 'Content-Type': 'application/json' },
                   body: JSON.stringify(payload)
               });
        const result = await response.json();

        if (result.candidates && result.candidates.length > 0 &&
            result.candidates[0].content && result.candidates[0].content.parts &&
            result.candidates[0].content.parts.length > 0) {
          const jsonText = result.candidates[0].content.parts[0].text;
          const parsedData = JSON.parse(jsonText);
          // Update state with parsed data, converting nulls to empty strings for input fields
          const newBloodTests = {};
          for (const key in parsedData) {
            newBloodTests[key] = parsedData[key] !== null ? parsedData[key] : '';
          }
          setBloodTests(prev => ({ ...prev, ...newBloodTests }));
          setMessage("วิเคราะห์ผลเลือดจากรูปภาพและกรอกข้อมูลเรียบร้อยแล้ว!");
          setMessageType('success');
        } else {
          setMessage("ไม่สามารถวิเคราะห์ผลเลือดจากรูปภาพได้");
          setMessageType('error');
        }
      } catch (error) {
        console.error("Error analyzing blood test image:", error);
        setMessage("เกิดข้อผิดพลาดในการวิเคราะห์รูปภาพ");
        setMessageType('error');
      } finally {
        setIsAnalyzing(false);
      }
    };
    reader.readAsDataURL(file);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        <p className="ml-3 text-blue-600">กำลังโหลดผลเลือด...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-2xl font-semibold mb-6 text-center text-blue-700">บันทึกผลเลือด</h2>
      {message && <MessageAlert message={message} type={messageType} />}

      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <label htmlFor="bloodTestDate" className="block text-sm font-medium text-blue-800 mb-2">
          เลือกวันที่:
        </label>
        <input
          type="date"
          id="bloodTestDate"
          value={selectedDate}
          onChange={handleDateChange}
          className="mt-1 block w-full px-3 py-2 border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-200"
        />
      </div>

      <div className="mb-6 p-4 bg-purple-50 rounded-lg border border-purple-200">
        <label htmlFor="bloodTestUpload" className="block text-sm font-medium text-purple-800 mb-2">
          อัปโหลดผลเลือด (รูปภาพ):
        </label>
        <input
          type="file"
          id="bloodTestUpload"
          accept="image/*"
          onChange={handleImageUpload}
          disabled={isAnalyzing}
          className="mt-1 block w-full text-sm text-gray-500
            file:mr-4 file:py-2 file:px-4
            file:rounded-full file:border-0
            file:text-sm file:font-semibold
            file:bg-purple-100 file:text-purple-700
            hover:file:bg-purple-200 transition-colors duration-200"
        />
        {isAnalyzing && (
          <p className="text-purple-600 text-sm mt-2 flex items-center">
            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-600 mr-2"></span>
            กำลังวิเคราะห์... โปรดรอสักครู่
          </p>
        )}
        <p className="text-xs text-gray-500 mt-1">
          *การวิเคราะห์ผลจากรูปภาพอาจไม่สมบูรณ์ กรุณาตรวจสอบและแก้ไขข้อมูลที่กรอกอัตโนมัติ
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {Object.keys(groupedFields).map(groupName => (
          <div key={groupName} className="border border-gray-200 rounded-lg p-4 shadow-sm bg-gray-50">
            <h3 className="text-lg font-semibold text-gray-800 mb-3 border-b pb-2 border-gray-200">{groupName}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {groupedFields[groupName].map(field => (
                <div key={field.id}>
                  <label htmlFor={field.id} className="block text-sm font-medium text-gray-700 mb-1">
                    {field.label} ({field.unit}):
                  </label>
                  <input
                    type="number"
                    id={field.id}
                    name={field.id}
                    value={bloodTests[field.id] || ''}
                    onChange={handleChange}
                    step="any"
                    placeholder={`ป้อนค่า ${field.label}`}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-200"
                  />
                </div>
              ))}
            </div>
          </div>
        ))}
        <button
          type="submit"
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105 text-lg"
        >
          บันทึกผลเลือด
        </button>
      </form>
    </div>
  );
};

// Food Tracking Page Component
const FoodTrackingPage = () => {
  const { db, userId, appId, isPremium } = useAppContext();
  const [selectedDate, setSelectedDate] = useState(formatDate(new Date()));
  const [dailyMeals, setDailyMeals] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestedMenus, setSuggestedMenus] = useState([]);
  const [showAddMealModal, setShowAddMealModal] = useState(false);
  const [newMealName, setNewMealName] = useState('');
  const [searchedMealNutrition, setSearchedMealNutrition] = useState(null);
  const [isSearchingNutrition, setIsSearchingNutrition] = useState(false);
  const [showNutritionDetailModal, setShowNutritionDetailModal] = useState(false);
  const [selectedMealForDetail, setSelectedMealForDetail] = useState(null);
  const [isLoadingDailyMeals, setIsLoadingDailyMeals] = useState(true);


  // Fetch daily meals
  useEffect(() => {
    if (!db || !userId) return;
    setIsLoadingDailyMeals(true);
    const docRef = doc(db, `artifacts/${appId}/users/${userId}/foodLogs`, selectedDate);
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        setDailyMeals(docSnap.data().meals || []);
      } else {
        setDailyMeals([]);
      }
      setIsLoadingDailyMeals(false);
    }, (error) => {
      console.error("Error fetching daily meals:", error);
      setMessage("เกิดข้อผิดพลาดในการโหลดข้อมูลอาหาร");
      setMessageType('error');
      setIsLoadingDailyMeals(false);
    });

    return () => unsubscribe();
  }, [db, userId, appId, selectedDate]);

  // Auto-generate suggestions on component mount
  useEffect(() => {
    handleGenerateSuggestions();
  }, []); // Empty dependency array means this runs once on mount

  const handleDateChange = (e) => {
    setSelectedDate(e.target.value);
  };

  const handleAddMeal = async (meal) => {
    if (!db || !userId) {
      setMessage("ไม่สามารถบันทึกได้: ผู้ใช้ไม่ได้เข้าสู่ระบบ");
      setMessageType('error');
      return;
    }
    try {
      const docRef = doc(db, `artifacts/${appId}/users/${userId}/foodLogs`, selectedDate);
      const currentMeals = dailyMeals || [];
      // Ensure dailyTotals and status are updated when adding a meal
      const updatedMeals = [...currentMeals, meal];
      const newDailyTotals = updatedMeals.reduce((acc, currentMeal) => {
        for (const key in currentMeal.nutrition) {
          acc[key] = (acc[key] || 0) + (parseFloat(currentMeal.nutrition[key]) || 0);
        }
        return acc;
      }, {});

      let newStatus = 'ปกติ';
      if (newDailyTotals.calories > DAILY_NUTRIENT_LIMITS.calories * 1.1 ||
          newDailyTotals.protein > DAILY_NUTRIENT_LIMITS.protein * 1.5 ||
          newDailyTotals.totalFat > DAILY_NUTRIENT_LIMITS.totalFat * 1.5 ||
          newDailyTotals.sugars > DAILY_NUTRIENT_LIMITS.sugars * 1.5 ||
          newDailyTotals.sodium > DAILY_NUTRIENT_LIMITS.sodium * 1.5) {
        newStatus = 'ได้รับสารอาหารเกิน';
      } else if (newDailyTotals.calories < DAILY_NUTRIENT_LIMITS.calories * 0.9 ||
                 newDailyTotals.protein < DAILY_NUTRIENT_LIMITS.protein * 0.7 ||
                 newDailyTotals.fiber < DAILY_NUTRIENT_LIMITS.fiber * 0.7) {
        newStatus = 'ได้รับสารอาหารน้อยเกินไป';
      }

      await setDoc(docRef, { meals: updatedMeals, dailyTotals: newDailyTotals, status: newStatus }, { merge: true });
      setMessage("เพิ่มอาหารเรียบร้อยแล้ว!");
      setMessageType('success');
      setShowAddMealModal(false);
      setNewMealName('');
      setSearchedMealNutrition(null);
    } catch (error) {
      console.error("Error adding meal:", error);
      setMessage("เกิดข้อผิดพลาดในการเพิ่มอาหาร");
      setMessageType('error');
    }
  };

  const handleDeleteMeal = async (indexToDelete) => {
    if (!db || !userId) {
      setMessage("ไม่สามารถลบได้: ผู้ใช้ไม่ได้เข้าสู่ระบบ");
      setMessageType('error');
      return;
    }
    try {
      const docRef = doc(db, `artifacts/${appId}/users/${userId}/foodLogs`, selectedDate);
      const updatedMeals = dailyMeals.filter((_, index) => index !== indexToDelete);

      // Recalculate daily totals and status after deletion
      const newDailyTotals = updatedMeals.reduce((acc, currentMeal) => {
        for (const key in currentMeal.nutrition) {
          acc[key] = (acc[key] || 0) + (parseFloat(currentMeal.nutrition[key]) || 0);
        }
        return acc;
      }, {});

      let newStatus = 'ปกติ';
      if (newDailyTotals.calories > DAILY_NUTRIENT_LIMITS.calories * 1.1 ||
          newDailyTotals.protein > DAILY_NUTRIENT_LIMITS.protein * 1.5 ||
          newDailyTotals.totalFat > DAILY_NUTRIENT_LIMITS.totalFat * 1.5 ||
          newDailyTotals.sugars > DAILY_NUTRIENT_LIMITS.sugars * 1.5 ||
          newDailyTotals.sodium > DAILY_NUTRIENT_LIMITS.sodium * 1.5) {
        newStatus = 'ได้รับสารอาหารเกิน';
      } else if (newDailyTotals.calories < DAILY_NUTRIENT_LIMITS.calories * 0.9 ||
                 newDailyTotals.protein < DAILY_NUTRIENT_LIMITS.protein * 0.7 ||
                 newDailyTotals.fiber < DAILY_NUTRIENT_LIMITS.fiber * 0.7) {
        newStatus = 'ได้รับสารอาหารน้อยเกินไป';
      }

      await setDoc(docRef, { meals: updatedMeals, dailyTotals: newDailyTotals, status: newStatus }, { merge: true });
      setMessage("ลบอาหารเรียบร้อยแล้ว!");
      setMessageType('success');
    } catch (error) {
      console.error("Error deleting meal:", error);
      setMessage("เกิดข้อผิดพลาดในการลบอาหาร");
      setMessageType('error');
    }
  };

  const calculateDailyNutrients = () => {
    const totals = {};
    for (const key in DAILY_NUTRIENT_LIMITS) {
      totals[key] = 0;
    }

    dailyMeals.forEach(meal => {
      for (const key in meal.nutrition) {
        if (totals.hasOwnProperty(key)) {
          totals[key] += parseFloat(meal.nutrition[key] || 0);
        }
      }
    });
    return totals;
  };

  const dailyNutrientTotals = calculateDailyNutrients();

  const chartData = Object.keys(DAILY_NUTRIENT_LIMITS).map(key => ({
    name: key.charAt(0).toUpperCase() + key.slice(1),
    Consumed: dailyNutrientTotals[key],
    Limit: DAILY_NUTRIENT_LIMITS[key],
  }));

  const handleGenerateSuggestions = async () => {
    setLoadingSuggestions(true);
    setMessage('');
    setMessageType('info');
    setSuggestedMenus([]);

    const prompt = `
      โปรดแนะนำเมนูอาหารเช้า กลางวัน และเย็น พร้อมข้อมูลโภชนาการสำหรับแต่ละเมนู (พลังงาน, คาร์โบไฮเดรต, น้ำตาล, ไฟเบอร์, โปรตีน, ไขมันรวม, ไขมันอิ่มตัว, ไขมันไม่อิ่มตัว, คอเลสเตอรอล, โซเดียม, โพแทสเซียม, แคลเซียม, แมกนีเซียม) ในรูปแบบ JSON Array. แต่ละเมนูควรมีชื่อเมนู (recipeName) และรายการโภชนาการ (nutrition) โดยค่าโภชนาการเป็นตัวเลขเท่านั้น (ไม่ต้องมีหน่วย).
      ตัวอย่างรูปแบบ JSON:
      [
        {
          "recipeName": "ชื่อเมนู 1",
          "nutrition": {
            "calories": 350,
            "carbohydrates": 45,
            "sugars": 10,
            "fiber": 5,
            "protein": 20,
            "totalFat": 15,
            "saturatedFat": 5,
            "unsaturatedFat": 10,
            "cholesterol": 50,
            "sodium": 300,
            "potassium": 400,
            "calcium": 150,
            "magnesium": 50
          }
        },
        {
          "recipeName": "ชื่อเมนู 2",
          "nutrition": { ... }
        }
      ]
      ขอเมนูที่หลากหลายและสมดุลสำหรับคนทั่วไป.
    `;

    try {
      const chatHistory = [];
      chatHistory.push({ role: "user", parts: [{ text: prompt }] });
      const payload = {
        contents: chatHistory,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "ARRAY",
            items: {
              type: "OBJECT",
              properties: {
                "recipeName": { "type": "STRING" },
                "nutrition": {
                  type: "OBJECT",
                  properties: {
                    "calories": { "type": "NUMBER" },
                    "carbohydrates": { "type": "NUMBER" },
                    "sugars": { "type": "NUMBER" },
                    "fiber": { "type": "NUMBER" },
                    "protein": { "type": "NUMBER" },
                    "totalFat": { "type": "NUMBER" },
                    "saturatedFat": { "type": "NUMBER" },
                    "unsaturatedFat": { "type": "NUMBER" },
                    "cholesterol": { "type": "NUMBER" },
                    "sodium": { "type": "NUMBER" },
                    "potassium": { "type": "NUMBER" },
                    "calcium": { "type": "NUMBER" },
                    "magnesium": { "type": "NUMBER" }
                  }
                }
              },
              "propertyOrdering": ["recipeName", "nutrition"]
            }
          }
        }
      };

      const apiKey = ""; // Canvas will provide this
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const jsonText = result.candidates[0].content.parts[0].text;
        const parsedJson = JSON.parse(jsonText);
        setSuggestedMenus(parsedJson);
        setMessage("สร้างข้อเสนอแนะเมนูเรียบร้อยแล้ว!");
        setMessageType('success');
      } else {
        setMessage("ไม่สามารถสร้างข้อเสนอแนะเมนูได้");
        setMessageType('error');
      }
    } catch (error) {
      console.error("Error generating menu suggestions:", error);
      setMessage("เกิดข้อผิดพลาดในการสร้างข้อเสนอแนะเมนู");
      setMessageType('error');
    } finally {
      setLoadingSuggestions(false);
    }
  };

  const handleSearchNutrition = async () => {
    if (!newMealName.trim()) {
      setMessage("กรุณาป้อนชื่ออาหารเพื่อค้นหาข้อมูลโภชนาการ");
      setMessageType('warning');
      return;
    }
    setIsSearchingNutrition(true);
    setSearchedMealNutrition(null);
    setMessage('กำลังค้นหาข้อมูลโภชนาการ...');
    setMessageType('info');

    const prompt = `
      โปรดให้ข้อมูลโภชนาการสำหรับ "${newMealName}" ในรูปแบบ JSON Object.
      ข้อมูลที่ต้องการ: พลังงาน (calories), คาร์โบไฮเดรต (carbohydrates), น้ำตาล (sugars), ไฟเบอร์ (fiber), โปรตีน (protein), ไขมันรวม (totalFat), ไขมันอิ่มตัว (saturatedFat), ไขมันไม่อิ่มตัว (unsaturatedFat), คอเลสเตอรอล (cholesterol), โซเดียม (sodium), โพแทสเซียม (potassium), แคลเซียม (calcium), แมกนีเซียม (magnesium).
      ค่าโภชนาการเป็นตัวเลขเท่านั้น (ไม่ต้องมีหน่วย). หากไม่พบข้อมูล ให้ระบุเป็น null.
      ตัวอย่างรูปแบบ JSON:
      {
        "calories": 350,
        "carbohydrates": 45,
        "sugars": 10,
        "fiber": 5,
        "protein": 20,
        "totalFat": 15,
        "saturatedFat": 5,
        "unsaturatedFat": 10,
        "cholesterol": 50,
        "sodium": 300,
        "potassium": 400,
        "calcium": 150,
        "magnesium": 50
      }
    `;

    try {
      const chatHistory = [];
      chatHistory.push({ role: "user", parts: [{ text: prompt }] });
      const payload = {
        contents: chatHistory,
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              "calories": { "type": ["number", "null"] },
              "carbohydrates": { "type": ["number", "null"] },
              "sugars": { "type": ["number", "null"] },
              "fiber": { "type": ["number", "null"] },
              "protein": { "type": ["number", "null"] },
              "totalFat": { "type": ["number", "null"] },
              "saturatedFat": { "type": ["number", "null"] },
              "unsaturatedFat": { "type": ["number", "null"] },
              "cholesterol": { "type": ["number", "null"] },
              "sodium": { "type": ["number", "null"] },
              "potassium": { "type": ["number", "null"] },
              "calcium": { "type": ["number", "null"] },
              "magnesium": { "type": ["number", "null"] }
            }
          }
        }
      };

      const apiKey = ""; // Canvas will provide this
      const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await response.json();

      if (result.candidates && result.candidates.length > 0 &&
          result.candidates[0].content && result.candidates[0].content.parts &&
          result.candidates[0].content.parts.length > 0) {
        const jsonText = result.candidates[0].content.parts[0].text;
        const parsedData = JSON.parse(jsonText);
        setSearchedMealNutrition(parsedData);
        setMessage(`พบข้อมูลโภชนาการสำหรับ "${newMealName}"`);
        setMessageType('success');
      } else {
        setMessage(`ไม่พบข้อมูลโภชนาการสำหรับ "${newMealName}"`);
        setMessageType('warning');
      }
    } catch (error) {
      console.error("Error searching nutrition:", error);
      setMessage("เกิดข้อผิดพลาดในการค้นหาข้อมูลโภชนาการ");
      setMessageType('error');
    } finally {
      setIsSearchingNutrition(false);
    }
  };

  const handleManualAddMealWithSearchedData = () => {
    if (!newMealName || !searchedMealNutrition) {
      setMessage("กรุณาป้อนชื่ออาหารและค้นหาข้อมูลโภชนาการก่อน");
      setMessageType('warning');
      return;
    }
    const meal = {
      recipeName: newMealName,
      nutrition: searchedMealNutrition,
      source: 'manual_searched'
    };
    handleAddMeal(meal);
  };

  const handleShowNutritionDetail = (meal) => {
    setSelectedMealForDetail(meal);
    setShowNutritionDetailModal(true);
  };

  const freeSuggestedMenus = suggestedMenus.slice(0, 3); // Limit free suggestions
  const premiumSuggestedMenus = suggestedMenus.slice(3); // Remaining for premium

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-2xl font-semibold mb-6 text-center text-blue-700">ติดตามอาหาร</h2>
      {message && <MessageAlert message={message} type={messageType} />}

      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <label htmlFor="foodDate" className="block text-sm font-medium text-blue-800 mb-2">
          เลือกวันที่:
        </label>
        <input
          type="date"
          id="foodDate"
          value={selectedDate}
          onChange={handleDateChange}
          className="mt-1 block w-full px-3 py-2 border border-blue-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm transition-all duration-200"
        />
      </div>

      <div className="mb-6">
        <h3 className="text-xl font-medium mb-4 text-blue-600">เมนูที่แนะนำสำหรับคุณ</h3>
        {loadingSuggestions ? (
          <p className="text-blue-600 text-sm mt-2 flex items-center justify-center py-4">
            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></span>
            กำลังสร้างข้อเสนอแนะเมนู...
          </p>
        ) : suggestedMenus.length === 0 ? (
          <p className="text-gray-500 text-center py-4">ไม่สามารถสร้างข้อเสนอแนะเมนูได้ในขณะนี้</p>
        ) : (
          <div className="mt-4 space-y-3">
            {freeSuggestedMenus.map((menu, index) => (
              <div key={index} className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow duration-200">
                <div>
                  <p className="font-semibold text-gray-800">{menu.recipeName}</p>
                  <p className="text-sm text-gray-600">แคลอรี่: {menu.nutrition.calories} kcal</p>
                </div>
                <button
                  onClick={() => handleAddMeal(menu)}
                  className="bg-blue-500 hover:bg-blue-600 text-white text-sm py-1.5 px-4 rounded-md shadow-sm hover:shadow-md transition-all duration-200"
                >
                  เพิ่ม
                </button>
              </div>
            ))}
            {premiumSuggestedMenus.length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <h4 className="text-lg font-medium text-purple-600 mb-3">เมนูเพิ่มเติม (Premium)</h4>
                {!isPremium ? (
                  <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg text-yellow-800 text-center shadow-inner">
                    อัปเกรดเป็น Premium เพื่อดูเมนูเพิ่มเติมและคุณสมบัติพิเศษ!
                  </div>
                ) : (
                  premiumSuggestedMenus.map((menu, index) => (
                    <div key={`premium-${index}`} className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex justify-between items-center mb-2 shadow-sm hover:shadow-md transition-shadow duration-200">
                      <div>
                        <p className="font-semibold text-gray-800">{menu.recipeName}</p>
                        <p className="text-sm text-gray-600">แคลอรี่: {menu.nutrition.calories} kcal</p>
                      </div>
                      <button
                        onClick={() => handleAddMeal(menu)}
                        className="bg-blue-500 hover:bg-blue-600 text-white text-sm py-1.5 px-4 rounded-md shadow-sm hover:shadow-md transition-all duration-200"
                      >
                        เพิ่ม
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="mb-6">
        <h3 className="text-xl font-medium mb-4 text-blue-600">อาหารที่กินวันนี้ ({selectedDate})</h3>
        {isLoadingDailyMeals ? (
           <p className="text-blue-600 text-sm mt-2 flex items-center justify-center py-4">
            <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></span>
            กำลังโหลดอาหารที่กินวันนี้...
          </p>
        ) : dailyMeals.length === 0 ? (
          <p className="text-gray-500 text-center py-4">ยังไม่มีอาหารสำหรับวันนี้ เริ่มต้นเพิ่มอาหารของคุณเลย!</p>
        ) : (
          <ul className="space-y-3">
            {dailyMeals.map((meal, index) => (
              <li key={index} className="bg-gray-50 p-3 rounded-lg border border-gray-200 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow duration-200">
                <div>
                  <p className="font-semibold text-gray-800">{meal.recipeName}</p>
                  <p className="text-sm text-gray-600">แคลอรี่: {meal.nutrition.calories} kcal</p>
                  <button
                    onClick={() => handleShowNutritionDetail(meal)}
                    className="text-blue-500 text-xs hover:underline mt-1"
                  >
                    ดูรายละเอียดโภชนาการ
                  </button>
                </div>
                <button
                  onClick={() => handleDeleteMeal(index)}
                  className="bg-red-500 hover:bg-red-600 text-white text-sm py-1.5 px-3 rounded-md shadow-sm hover:shadow-md transition-all duration-200"
                >
                  ลบ
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          onClick={() => setShowAddMealModal(true)}
          className="w-full mt-6 bg-purple-500 hover:bg-purple-600 text-white font-bold py-3 px-4 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105 text-lg"
        >
          เพิ่มอาหารเอง
        </button>
      </div>

      <div className="mb-6">
        <h3 className="text-xl font-medium mb-4 text-blue-600">สรุปสารอาหารวันนี้</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} interval={0} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="Consumed" fill="#8884d8" name="บริโภค" barSize={30} radius={[10, 10, 0, 0]} />
            <Bar dataKey="Limit" fill="#82ca9d" name="ขีดจำกัด" barSize={30} radius={[10, 10, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Manual Add Meal Modal */}
      <CustomModal
        title="เพิ่มอาหารเอง"
        isOpen={showAddMealModal}
        onClose={() => { setShowAddMealModal(false); setNewMealName(''); setSearchedMealNutrition(null); setMessage(''); setMessageType('info'); }}
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="newMealName" className="block text-sm font-medium text-gray-700 mb-1">
              ชื่อเมนู:
            </label>
            <input
              type="text"
              id="newMealName"
              value={newMealName}
              onChange={(e) => setNewMealName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              placeholder="เช่น ข้าวผัดไก่"
            />
          </div>
          <button
            onClick={handleSearchNutrition}
            disabled={isSearchingNutrition}
            className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
          >
            {isSearchingNutrition ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                กำลังค้นหา...
              </>
            ) : 'ค้นหาข้อมูลโภชนาการ'}
          </button>

          {searchedMealNutrition && (
            <div className="mt-4 p-3 bg-gray-100 rounded-md border border-gray-200">
              <h4 className="font-medium text-gray-800 mb-2">ข้อมูลโภชนาการที่พบ:</h4>
              <ul className="text-sm text-gray-700 space-y-1">
                {Object.keys(DAILY_NUTRIENT_LIMITS).map(key => (
                  <li key={key}>
                    <span className="font-semibold">{key.charAt(0).toUpperCase() + key.slice(1)}:</span>{' '}
                    {searchedMealNutrition[key] !== null ? searchedMealNutrition[key] : 'N/A'}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {message && <MessageAlert message={message} type={messageType} />}
        </div>
        <div className="mt-6 flex justify-end space-x-3">
          <button
            onClick={() => { setShowAddMealModal(false); setNewMealName(''); setSearchedMealNutrition(null); setMessage(''); setMessageType('info'); }}
            className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded-lg shadow-md transition-all duration-200"
          >
            ยกเลิก
          </button>
          <button
            onClick={handleManualAddMealWithSearchedData}
            disabled={!searchedMealNutrition}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            เพิ่ม
          </button>
        </div>
      </CustomModal>

      {/* Nutrition Detail Modal */}
      <CustomModal
        title={`รายละเอียดโภชนาการของ ${selectedMealForDetail?.recipeName || ''}`}
        isOpen={showNutritionDetailModal}
        onClose={() => setShowNutritionDetailModal(false)}
      >
        <div className="space-y-2 text-gray-700">
          {selectedMealForDetail && Object.keys(DAILY_NUTRIENT_LIMITS).map(key => (
            <p key={key}>
              <span className="font-medium">{key.charAt(0).toUpperCase() + key.slice(1)}:</span>{' '}
              {selectedMealForDetail.nutrition[key] !== null ? `${selectedMealForDetail.nutrition[key]} ${
                key === 'calories' ? 'kcal' : (key.includes('fat') || key.includes('carbohydrates') || key.includes('protein') || key.includes('fiber') || key.includes('sugars') ? 'g' : 'mg')
              }` : 'N/A'}
            </p>
          ))}
        </div>
        <div className="mt-6 flex justify-end">
          <button
            onClick={() => setShowNutritionDetailModal(false)}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105"
          >
            ปิด
          </button>
        </div>
      </CustomModal>
    </div>
  );
};

// History Page Component
const HistoryPage = () => {
  const { db, userId, appId } = useAppContext();
  const [foodLogs, setFoodLogs] = useState([]);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('info');
  const [selectedDayDetails, setSelectedDayDetails] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  // Mock data for historical food logs - only populate if collection is empty
  const mockFoodLogs = [
    {
      date: formatDate(new Date(Date.now() - 0 * 24 * 60 * 60 * 1000)), // Today
      meals: [
        { recipeName: 'ข้าวผัดกะเพราไก่', nutrition: { calories: 450, carbohydrates: 50, sugars: 5, fiber: 3, protein: 30, totalFat: 20, saturatedFat: 8, unsaturatedFat: 12, cholesterol: 80, sodium: 800, potassium: 300, calcium: 50, magnesium: 40 } },
        { recipeName: 'ส้มตำไทย', nutrition: { calories: 250, carbohydrates: 30, sugars: 15, fiber: 5, protein: 5, totalFat: 10, saturatedFat: 2, unsaturatedFat: 8, cholesterol: 10, sodium: 1200, potassium: 400, calcium: 80, magnesium: 60 } },
        { recipeName: 'แกงเขียวหวานไก่', nutrition: { calories: 380, carbohydrates: 25, sugars: 8, fiber: 2, protein: 25, totalFat: 25, saturatedFat: 15, unsaturatedFat: 10, cholesterol: 70, sodium: 900, potassium: 350, calcium: 70, magnesium: 50 } },
      ],
    },
    {
      date: formatDate(new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)), // Yesterday
      meals: [
        { recipeName: 'โจ๊กหมู', nutrition: { calories: 300, carbohydrates: 40, sugars: 2, fiber: 1, protein: 15, totalFat: 10, saturatedFat: 3, unsaturatedFat: 7, cholesterol: 40, sodium: 600, potassium: 200, calcium: 30, magnesium: 20 } },
        { recipeName: 'ผัดไทยกุ้งสด', nutrition: { calories: 550, carbohydrates: 60, sugars: 20, fiber: 4, protein: 25, totalFat: 25, saturatedFat: 10, unsaturatedFat: 15, cholesterol: 150, sodium: 1500, potassium: 500, calcium: 100, magnesium: 70 } },
      ],
    },
    {
      date: formatDate(new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)),
      meals: [
        { recipeName: 'ข้าวไข่เจียว', nutrition: { calories: 350, carbohydrates: 30, sugars: 1, fiber: 0, protein: 15, totalFat: 20, saturatedFat: 7, unsaturatedFat: 13, cholesterol: 200, sodium: 400, potassium: 150, calcium: 20, magnesium: 15 } },
        { recipeName: 'ก๋วยเตี๋ยวเรือ', nutrition: { calories: 400, carbohydrates: 45, sugars: 5, fiber: 2, protein: 20, totalFat: 18, saturatedFat: 6, unsaturatedFat: 12, cholesterol: 60, sodium: 1000, potassium: 300, calcium: 40, magnesium: 30 } },
      ],
    },
    {
      date: formatDate(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)),
      meals: [
        { recipeName: 'สุกี้น้ำ', nutrition: { calories: 320, carbohydrates: 20, sugars: 3, fiber: 4, protein: 30, totalFat: 15, saturatedFat: 5, unsaturatedFat: 10, cholesterol: 50, sodium: 700, potassium: 450, calcium: 120, magnesium: 80 } },
      ],
    },
      {
      date: formatDate(new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)),
      meals: [
        { recipeName: 'ข้าวผัด', nutrition: { calories: 480, carbohydrates: 55, sugars: 7, fiber: 2, protein: 25, totalFat: 22, saturatedFat: 9, unsaturatedFat: 13, cholesterol: 90, sodium: 850, potassium: 320, calcium: 60, magnesium: 45 } },
        { recipeName: 'ต้มยำกุ้ง', nutrition: { calories: 200, carbohydrates: 15, sugars: 5, fiber: 1, protein: 18, totalFat: 10, saturatedFat: 3, unsaturatedFat: 7, cholesterol: 100, sodium: 1100, potassium: 280, calcium: 50, magnesium: 35 } },
      ],
    },
    {
      date: formatDate(new Date(Date.now() - 5 * 24 * 60 * 60 * 1000)),
      meals: [
        { recipeName: 'ผัดซีอิ๊ว', nutrition: { calories: 600, carbohydrates: 70, sugars: 10, fiber: 3, protein: 20, totalFat: 30, saturatedFat: 12, unsaturatedFat: 18, cholesterol: 120, sodium: 1400, potassium: 400, calcium: 80, magnesium: 55 } },
      ],
    },
    {
      date: formatDate(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000)),
      meals: [
        { recipeName: 'แกงส้ม', nutrition: { calories: 280, carbohydrates: 20, sugars: 8, fiber: 5, protein: 22, totalFat: 12, saturatedFat: 4, unsaturatedFat: 8, cholesterol: 60, sodium: 950, potassium: 500, calcium: 100, magnesium: 70 } },
        { recipeName: 'ขนมจีนน้ำยา', nutrition: { calories: 420, carbohydrates: 50, sugars: 6, fiber: 4, protein: 18, totalFat: 20, saturatedFat: 8, unsaturatedFat: 12, cholesterol: 70, sodium: 1300, potassium: 380, calcium: 70, magnesium: 50 } },
      ],
    },
  ];

  useEffect(() => {
    if (!db || !userId) return;

    const foodLogsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/foodLogs`);

    // Check if collection is empty and populate mock data if it is
    const checkAndPopulateMockData = async () => {
      try {
        const snapshot = await getDocs(foodLogsCollectionRef);
        if (snapshot.empty) {
          setMessage('กำลังเพิ่มข้อมูลตัวอย่างประวัติอาหาร...');
          setMessageType('info');
          for (const log of mockFoodLogs) {
            // Calculate daily totals and status for mock data
            const dailyTotals = log.meals.reduce((acc, meal) => {
              for (const key in meal.nutrition) {
                acc[key] = (acc[key] || 0) + (parseFloat(meal.nutrition[key]) || 0);
              }
              return acc;
            }, {});

            let status = 'ปกติ';
            if (dailyTotals.calories > DAILY_NUTRIENT_LIMITS.calories * 1.1 ||
                dailyTotals.protein > DAILY_NUTRIENT_LIMITS.protein * 1.5 ||
                dailyTotals.totalFat > DAILY_NUTRIENT_LIMITS.totalFat * 1.5 ||
                dailyTotals.sugars > DAILY_NUTRIENT_LIMITS.sugars * 1.5 ||
                dailyTotals.sodium > DAILY_NUTRIENT_LIMITS.sodium * 1.5) {
              status = 'ได้รับสารอาหารเกิน';
            } else if (dailyTotals.calories < DAILY_NUTRIENT_LIMITS.calories * 0.9 ||
                       dailyTotals.protein < DAILY_NUTRIENT_LIMITS.protein * 0.7 ||
                       dailyTotals.fiber < DAILY_NUTRIENT_LIMITS.fiber * 0.7) {
              status = 'ได้รับสารอาหารน้อยเกินไป';
            }

            await setDoc(doc(foodLogsCollectionRef, log.date), {
              meals: log.meals,
              dailyTotals: dailyTotals,
              status: status
            });
          }
          setMessage('เพิ่มข้อมูลตัวอย่างประวัติอาหารเรียบร้อยแล้ว!');
          setMessageType('success');
        }
      } catch (error) {
        console.error("Error checking/populating mock data:", error);
        setMessage("เกิดข้อผิดพลาดในการเตรียมข้อมูลตัวอย่าง");
        setMessageType('error');
      }
    };

    checkAndPopulateMockData(); // Run once to check and populate

    // Set up real-time listener for food logs
    const unsubscribe = onSnapshot(foodLogsCollectionRef, (snapshot) => {
      const logs = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        const date = doc.id; // Document ID is the date (YYYY-MM-DD)
        const meals = data.meals || [];
        const dailyTotals = data.dailyTotals || {}; // Use stored daily totals if available
        const status = data.status || 'ปกติ'; // Use stored status if available

        logs.push({
          date: date,
          meals: meals,
          dailyTotals: dailyTotals,
          status: status,
        });
      });
      // Sort by date descending
      logs.sort((a, b) => new Date(b.date) - new Date(a.date));
      setFoodLogs(logs);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching food logs history:", error);
      setMessage("เกิดข้อผิดพลาดในการโหลดประวัติอาหาร");
      setMessageType('error');
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, userId, appId]); // Dependencies

  // Prepare data for monthly visualization (e.g., calories over time)
  const monthlyChartData = foodLogs.map(log => ({
    date: log.date,
    calories: log.dailyTotals.calories || 0,
    protein: log.dailyTotals.protein || 0,
    fat: log.dailyTotals.totalFat || 0,
    carbs: log.dailyTotals.carbohydrates || 0,
  })).reverse(); // Reverse to show chronological order for chart

  const getStatusColor = (status) => {
    switch (status) {
      case 'ได้รับสารอาหารเกิน': return 'bg-red-100 text-red-800';
      case 'ได้รับสารอาหารน้อยเกินไป': return 'bg-yellow-100 text-yellow-800';
      case 'ปกติ': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-500"></div>
        <p className="ml-3 text-blue-600">กำลังโหลดประวัติ...</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
      <h2 className="text-2xl font-semibold mb-6 text-center text-blue-700">ประวัติและกราฟติดตาม</h2>
      {message && <MessageAlert message={message} type={messageType} />}

      <div className="mb-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
        <h3 className="text-xl font-medium mb-3 text-blue-600">กราฟสารอาหารรายวัน (ย้อนหลัง 30 วัน)</h3>
        {monthlyChartData.length === 0 ? (
          <p className="text-gray-500 text-center py-4">ไม่มีข้อมูลสำหรับแสดงกราฟ</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyChartData.slice(-30)} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="date" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="calories" stroke="#8884d8" name="พลังงาน (kcal)" strokeWidth={2} />
              <Line type="monotone" dataKey="protein" stroke="#82ca9d" name="โปรตีน (g)" strokeWidth={2} />
              <Line type="monotone" dataKey="fat" stroke="#ffc658" name="ไขมัน (g)" strokeWidth={2} />
              <Line type="monotone" dataKey="carbs" stroke="#ff7300" name="คาร์โบไฮเดรต (g)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="mb-6 p-4 bg-green-50 rounded-lg border border-green-200">
        <h3 className="text-xl font-medium mb-3 text-blue-600">สรุปการกินอาหารรายวัน</h3>
        {foodLogs.length === 0 ? (
          <p className="text-gray-500 text-center py-4">ยังไม่มีประวัติการกินอาหาร</p>
        ) : (
          <ul className="space-y-3">
            {foodLogs.map((log) => (
              <li key={log.date} className="bg-white p-3 rounded-lg border border-gray-200 flex justify-between items-center shadow-sm hover:shadow-md transition-shadow duration-200">
                <div>
                  <p className="font-semibold text-gray-800">{log.date}</p>
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(log.status)}`}>
                    {log.status}
                  </span>
                </div>
                <button
                  onClick={() => setSelectedDayDetails(log)}
                  className="bg-blue-500 hover:bg-blue-600 text-white text-sm py-1.5 px-3 rounded-md shadow-sm hover:shadow-md transition-all duration-200"
                >
                  ดูรายละเอียด
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Daily Details Modal */}
      <CustomModal
        title={`รายละเอียดอาหารวันที่ ${selectedDayDetails?.date || ''}`}
        isOpen={selectedDayDetails !== null}
        onClose={() => setSelectedDayDetails(null)}
      >
        <div className="space-y-3 mb-4">
          <p className="font-medium text-gray-800">สถานะ: <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(selectedDayDetails?.status || 'ปกติ')}`}>
                {selectedDayDetails?.status || 'ปกติ'}
              </span></p>
          <h4 className="font-medium text-gray-800 mt-4">อาหารที่กิน:</h4>
          <ul className="list-disc list-inside ml-4">
            {selectedDayDetails?.meals.length === 0 ? (
              <p className="text-gray-500">ไม่มีอาหารบันทึกไว้</p>
            ) : (
              selectedDayDetails?.meals.map((meal, index) => (
                <li key={index} className="text-gray-700">{meal.recipeName} ({meal.nutrition.calories} kcal)</li>
              ))
            )}
          </ul>
          <h4 className="font-medium text-gray-800 mt-4">สรุปสารอาหาร:</h4>
          <ul className="list-disc list-inside ml-4">
            {selectedDayDetails && Object.keys(selectedDayDetails.dailyTotals).map(key => (
              <li key={key} className="text-gray-700">
                {key.charAt(0).toUpperCase() + key.slice(1)}: {selectedDayDetails.dailyTotals[key].toFixed(2)}
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-end">
          <button
            onClick={() => setSelectedDayDetails(null)}
            className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg shadow-md transition-all duration-200 transform hover:scale-105"
          >
            ปิด
          </button>
        </div>
      </CustomModal>
    </div>
  );
};

export default App;
