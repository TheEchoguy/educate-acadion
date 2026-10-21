import React, { useState } from 'react';
import toast from 'react-hot-toast';
import './AiContentStudioSection.css';

export default function AiContentStudioSection({ classroomId, isTeacher = true }) {
  const [activeTool, setActiveTool] = useState('ppt'); // 'ppt' | 'paper' | 'quiz'
  const [selectedModule, setSelectedModule] = useState(2);
  const [slideCount, setSlideCount] = useState(15);
  const [pedagogicalStyle, setPedagogicalStyle] = useState('engineering');
  const [isGenerating, setIsGenerating] = useState(false);
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);

  // Paper drafter state
  const [assessmentType, setAssessmentType] = useState('IA1');
  const [bloomsLevels, setBloomsLevels] = useState({ L1: true, L2: true, L3: true, L4: false });
  const [isDraftingPaper, setIsDraftingPaper] = useState(false);

  // Diagnostic quiz state
  const [selectedWeakTopic, setSelectedWeakTopic] = useState('snmp');
  const [selectedOption, setSelectedOption] = useState(null);
  const [isPublishingQuiz, setIsPublishingQuiz] = useState(false);

  // Curriculum slide preview mapping
  const moduleSlideData = {
    1: [
      {
        title: "Internet of Things [BCS701] - Module 1",
        subtitle: "Introduction & Physical Design of IoT",
        bullets: [
          "Core definition: Unique physical & virtual 'Things' connected to internet infrastructure",
          "Dynamic & self-adapting systems across changing physical environments",
          "Generic IoT Device Block Diagram: Sensors, Actuators, Compute & Transceivers",
          "Syllabus scope: VTU 2022 Scheme engineering curriculum"
        ]
      },
      {
        title: "IoT Protocol Link & Network Layers",
        subtitle: "Communication Standards & IPv6 Integration",
        bullets: [
          "IEEE 802.11 Wi-Fi (2.4 GHz & 5 GHz), IEEE 802.15.4 LR-WPAN & ZigBee",
          "IPv4 32-bit vs IPv6 128-bit hierarchical addressing architecture",
          "6LoWPAN: Header compression enabling IP packets over constrained 802.15.4 links",
          "TCP (connection-oriented, reliable) vs UDP (transactional, low-latency)"
        ]
      }
    ],
    2: [
      {
        title: "Internet of Things [BCS701] - Module 2",
        subtitle: "M2M Systems, SDN/NFV & IoT Systems Management",
        bullets: [
          "M2M vs IoT: Non-IP local proprietary loops vs IP-based global cloud analytics",
          "M2M Gateway: Bridging heterogeneous short-range protocols with WAN/Internet",
          "Software-Defined Networking (SDN): Decoupling control plane from data plane hardware",
          "Network Function Virtualization (NFV): Running VNFs on standard cloud infrastructure"
        ]
      },
      {
        title: "IoT Systems Management with NETCONF-YANG",
        subtitle: "Addressing Limitations of Legacy SNMP",
        bullets: [
          "SNMP operational limitations: Stateless UDP transport, read-only MIBs, lack of ACID transactions",
          "NETCONF layered protocol stack: Transport (SSH), RPC (XML), Operations, Content",
          "YANG data modeling: Modeling configuration vs operational state hierarchies",
          "Netopeer implementation: Server, client CLI, and TransAPI callbacks"
        ]
      }
    ],
    3: [
      {
        title: "Internet of Things [BCS701] - Module 3",
        subtitle: "IoT Platforms Design Methodology & Python",
        bullets: [
          "10-Step Design Methodology: Purpose, Requirement, Domain Model, Information Model",
          "Service Specification, Functional View, Operational View, Device & Component Integration",
          "Python packages for IoT: Requests, PyMongo, NumPy, and Socket programming",
          "API design: RESTful web services vs WebSocket bidirectional streaming"
        ]
      }
    ],
    4: [
      {
        title: "Internet of Things [BCS701] - Module 4",
        subtitle: "Physical Devices & Raspberry Pi",
        bullets: [
          "Raspberry Pi hardware architecture: Broadcom SoC, GPIO pinouts, SPI & I2C interfaces",
          "Linux on Raspberry Pi: Raspbian OS configuration, systemd service management",
          "Interfacing digital sensors: Temperature (DHT11), Ultrasonic (HC-SR04), PIR motion",
          "Cloud IoT agent deployment: Sending telemetry via MQTT & HTTP endpoints"
        ]
      }
    ],
    5: [
      {
        title: "Internet of Things [BCS701] - Module 5",
        subtitle: "Data Analytics for IoT & Big Data",
        bullets: [
          "High-volume time-series telemetry pipelines: Ingestion, transformation, analytics",
          "Apache Hadoop ecosystem: HDFS distributed storage & MapReduce parallel processing",
          "Real-time stream analytics with Apache Storm & Apache Kafka message brokers",
          "Predictive maintenance & anomaly detection models on smart grid IoT streams"
        ]
      }
    ]
  };

  const slides = moduleSlideData[selectedModule] || moduleSlideData[2];
  const activeSlide = slides[currentSlideIndex % slides.length];

  const handleGeneratePpt = () => {
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      toast.success(`Generated ${slideCount}-slide .PPTX Deck for Module ${selectedModule}! Download started.`);
      
      // Trigger programmatic download of syllabus presentation summary
      const blob = new Blob([
        `ACADION AI CONTENT STUDIO - SYLLABUS PRESENTATION DECK\n` +
        `Subject: Internet of Things (BCS701)\n` +
        `Module: ${selectedModule}\n` +
        `Slide Count: ${slideCount}\n` +
        `Pedagogical Style: ${pedagogicalStyle === 'engineering' ? 'VTU Engineering Lecture' : 'Exam Quick Revision'}\n\n` +
        `Slide 1: ${activeSlide.title}\n` +
        `Subtitle: ${activeSlide.subtitle}\n` +
        activeSlide.bullets.map((b, i) => `  ${i + 1}. ${b}`).join('\n') +
        `\n\nGenerated with Acadion Objective 2 AI Studio Pipeline.`
      ], { type: 'text/plain;charset=utf-8' });
      
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `IoT_Module_${selectedModule}_Lecture_Deck.txt`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }, 1500);
  };

  const handleGeneratePaper = () => {
    setIsDraftingPaper(true);
    setTimeout(() => {
      setIsDraftingPaper(false);
      toast.success(`Drafted university-standard ${assessmentType} question paper with balanced Part A/B choice groups!`);
    }, 1200);
  };

  const handlePublishQuiz = () => {
    setIsPublishingQuiz(true);
    setTimeout(() => {
      setIsPublishingQuiz(false);
      toast.success("Diagnostic quiz published to student workspace! Risk coach notifications triggered.");
    }, 1200);
  };

  return (
    <div className="content-studio-container">
      {/* Header Banner */}
      <div className="studio-header-card">
        <div className="studio-title-area">
          <div className="studio-badge-row">
            <span className="studio-badge">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10"></circle>
                <polygon points="12 8 8 12 12 16 16 12 12 8"></polygon>
              </svg>
              Objective 2 • Automated Pedagogical Generation
            </span>
            <span className="studio-sub-badge">Production Studio</span>
          </div>
          <h2>AI Academic Content Studio</h2>
          <p>
            Generate syllabus-aligned PowerPoint presentations, university-standard CIE/SEE 
            examination drafts, and targeted diagnostic quizzes grounded directly in uploaded course notes.
          </p>
        </div>

        <div className="studio-status-pill">
          <span className="pulse-dot"></span>
          <span>Pipeline Ready</span>
        </div>
      </div>

      {/* Tool Selection Tabs */}
      <div className="studio-tab-strip">
        <button 
          type="button"
          className={`studio-tab-btn ${activeTool === 'ppt' ? 'active' : ''}`}
          onClick={() => setActiveTool('ppt')}
        >
          <svg className="tab-svg-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
            <line x1="8" y1="21" x2="16" y2="21"></line>
            <line x1="12" y1="17" x2="12" y2="21"></line>
          </svg>
          <span>Syllabus-to-PPT Generator</span>
        </button>

        <button 
          type="button"
          className={`studio-tab-btn ${activeTool === 'paper' ? 'active' : ''}`}
          onClick={() => setActiveTool('paper')}
        >
          <svg className="tab-svg-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="16" y1="13" x2="8" y2="13"></line>
            <line x1="16" y1="17" x2="8" y2="17"></line>
            <polyline points="10 9 9 9 8 9"></polyline>
          </svg>
          <span>CIE / SEE Paper Drafter</span>
        </button>

        <button 
          type="button"
          className={`studio-tab-btn ${activeTool === 'quiz' ? 'active' : ''}`}
          onClick={() => setActiveTool('quiz')}
        >
          <svg className="tab-svg-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M10 2v7.31L4.89 20A2 2 0 0 0 6.64 23h10.72a2 2 0 0 0 1.75-3L14 9.31V2"></path>
            <line x1="8.5" y1="2" x2="15.5" y2="2"></line>
            <line x1="7" y1="14" x2="17" y2="14"></line>
          </svg>
          <span>Diagnostic Quiz & Assignment Builder</span>
        </button>
      </div>

      {/* Main Studio Work Area */}
      <div className="studio-card-deck">
        {/* TOOL 1: SYLLABUS-TO-PPT GENERATOR */}
        {activeTool === 'ppt' && (
          <div className="studio-tool-panel">
            <div className="panel-left">
              <div className="panel-badge-bar">
                <span className="tool-type-badge">Tool 1: Presentation Synthesis</span>
                <span className="accent-tag">VTU Scheme</span>
              </div>
              <h3>Generate Structured PowerPoint Presentation</h3>
              <p className="panel-desc">
                Extracts key definitions, architectural block diagrams, and protocol flows from course notes 
                into an exam-oriented lecture presentation.
              </p>
              
              <div className="input-group">
                <label>Target Syllabus Module</label>
                <select 
                  value={selectedModule} 
                  onChange={(e) => {
                    setSelectedModule(Number(e.target.value));
                    setCurrentSlideIndex(0);
                  }}
                >
                  <option value={1}>Module 1: IoT Introduction & Logical Design</option>
                  <option value={2}>Module 2: IoT vs M2M & Systems Management</option>
                  <option value={3}>Module 3: IoT Platforms Design & Python</option>
                  <option value={4}>Module 4: Physical Devices & Raspberry Pi</option>
                  <option value={5}>Module 5: Data Analytics for IoT (Hadoop/Storm)</option>
                </select>
              </div>

              <div className="input-row">
                <div className="input-group">
                  <label>Slide Count</label>
                  <input 
                    type="number" 
                    value={slideCount} 
                    min={5} 
                    max={40} 
                    onChange={(e) => setSlideCount(Math.max(5, Math.min(40, Number(e.target.value) || 15)))}
                  />
                </div>
                <div className="input-group">
                  <label>Pedagogical Style Preset</label>
                  <select 
                    value={pedagogicalStyle} 
                    onChange={(e) => setPedagogicalStyle(e.target.value)}
                  >
                    <option value="engineering">VTU Engineering Lecture (Concepts + Architecture)</option>
                    <option value="revision">Exam Quick Revision (Formulae + 10-Mark Questions)</option>
                  </select>
                </div>
              </div>

              <div className="studio-meta-box">
                <div className="meta-item">
                  <span className="meta-label">Grounding Source:</span>
                  <span className="meta-val">Module {selectedModule} Course Notes PDF</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Est. Slides:</span>
                  <span className="meta-val tabular">{slideCount} Slides</span>
                </div>
              </div>

              <button 
                type="button"
                className="studio-primary-action-btn"
                disabled={isGenerating}
                onClick={handleGeneratePpt}
              >
                {isGenerating ? (
                  <>
                    <span className="btn-spinner"></span>
                    <span>Synthesizing Slides from Notes...</span>
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                      <polyline points="7 10 12 15 17 10"></polyline>
                      <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                    <span>Generate & Download .PPTX Deck</span>
                  </>
                )}
              </button>
            </div>

            <div className="panel-right preview-stub">
              <div className="preview-header-bar">
                <span className="preview-indicator">
                  <span className="indicator-dot"></span> Live Slide Preview
                </span>
                <div className="slide-nav-controls">
                  <button 
                    type="button"
                    className="slide-nav-btn"
                    onClick={() => setCurrentSlideIndex((prev) => Math.max(0, prev - 1))}
                    disabled={currentSlideIndex === 0}
                  >
                    ◀
                  </button>
                  <span className="slide-counter tabular">
                    {currentSlideIndex + 1} / {slides.length}
                  </span>
                  <button 
                    type="button"
                    className="slide-nav-btn"
                    onClick={() => setCurrentSlideIndex((prev) => (prev + 1) % slides.length)}
                  >
                    ▶
                  </button>
                </div>
              </div>

              <div className="preview-placeholder">
                <div className="slide-mockup">
                  <div className="slide-top-tag">
                    <span className="slide-badge tabular">Slide {currentSlideIndex + 1} of {slideCount}</span>
                    <span className="slide-domain">IoT [BCS701]</span>
                  </div>
                  <h4 className="slide-main-title">{activeSlide.title}</h4>
                  <h5 className="slide-sub-title">{activeSlide.subtitle}</h5>
                  <ul className="slide-bullet-list">
                    {activeSlide.bullets.map((b, i) => (
                      <li key={i}>{b}</li>
                    ))}
                  </ul>
                  <div className="slide-footer-bar">
                    <span>Acadion Pedagogical Generation Engine</span>
                    <span className="tabular">Page {selectedModule}.{currentSlideIndex + 1}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TOOL 2: CIE / SEE EXAM PAPER DRAFTER */}
        {activeTool === 'paper' && (
          <div className="studio-tool-panel">
            <div className="panel-left">
              <div className="panel-badge-bar">
                <span className="tool-type-badge">Tool 2: Assessment Drafter</span>
                <span className="accent-tag">Choice Groups</span>
              </div>
              <h3>Draft CIE / SEE Examination Paper</h3>
              <p className="panel-desc">
                Synthesizes balanced university question papers with Part A / Part B choice groups, 
                Bloom's Taxonomy distribution, and Course Outcomes (CO) mapping.
              </p>
              
              <div className="input-row">
                <div className="input-group">
                  <label>Assessment Type</label>
                  <select 
                    value={assessmentType} 
                    onChange={(e) => setAssessmentType(e.target.value)}
                  >
                    <option value="IA1">Internal Assessment 1 (Modules 1 & 2 - 40M)</option>
                    <option value="IA2">Internal Assessment 2 (Modules 3 & 4 - 40M)</option>
                    <option value="IA3">Internal Assessment 3 (Module 5 - 40M)</option>
                    <option value="SEE">Semester End Examination (Full Syllabus - 100M)</option>
                  </select>
                </div>
                <div className="input-group">
                  <label>Max Marks</label>
                  <input 
                    type="number" 
                    value={assessmentType === 'SEE' ? 100 : 40} 
                    disabled 
                    className="tabular"
                  />
                </div>
              </div>

              <div className="input-group">
                <label>Cognitive Levels (RBT / Bloom's Taxonomy)</label>
                <div className="checkbox-row">
                  <label className="checkbox-chip">
                    <input 
                      type="checkbox" 
                      checked={bloomsLevels.L1} 
                      onChange={(e) => setBloomsLevels({ ...bloomsLevels, L1: e.target.checked })}
                    />
                    <span>L1: Remember</span>
                  </label>
                  <label className="checkbox-chip">
                    <input 
                      type="checkbox" 
                      checked={bloomsLevels.L2} 
                      onChange={(e) => setBloomsLevels({ ...bloomsLevels, L2: e.target.checked })}
                    />
                    <span>L2: Understand</span>
                  </label>
                  <label className="checkbox-chip">
                    <input 
                      type="checkbox" 
                      checked={bloomsLevels.L3} 
                      onChange={(e) => setBloomsLevels({ ...bloomsLevels, L3: e.target.checked })}
                    />
                    <span>L3: Apply</span>
                  </label>
                  <label className="checkbox-chip">
                    <input 
                      type="checkbox" 
                      checked={bloomsLevels.L4} 
                      onChange={(e) => setBloomsLevels({ ...bloomsLevels, L4: e.target.checked })}
                    />
                    <span>L4: Analyze</span>
                  </label>
                </div>
              </div>

              <div className="studio-meta-box">
                <div className="meta-item">
                  <span className="meta-label">Choice Structure:</span>
                  <span className="meta-val">Part A (Q1 OR Q2) + Part B (Q3 OR Q4)</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Marks Per Question:</span>
                  <span className="meta-val tabular">10M Sub-Questions (20M/Part)</span>
                </div>
              </div>

              <button 
                type="button"
                className="studio-primary-action-btn"
                disabled={isDraftingPaper}
                onClick={handleGeneratePaper}
              >
                {isDraftingPaper ? (
                  <>
                    <span className="btn-spinner"></span>
                    <span>Drafting Balanced Question Paper...</span>
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                      <polyline points="14 2 14 8 20 8"></polyline>
                      <line x1="16" y1="13" x2="8" y2="13"></line>
                    </svg>
                    <span>Generate Balanced Question Paper (.DOCX / .PDF)</span>
                  </>
                )}
              </button>
            </div>

            <div className="panel-right preview-stub">
              <div className="preview-header-bar">
                <span className="preview-indicator">
                  <span className="indicator-dot"></span> Question Paper Layout
                </span>
                <span className="preview-format-tag">VTU Regulation Form</span>
              </div>

              <div className="preview-placeholder">
                <div className="paper-mockup">
                  <div className="paper-head">DON BOSCO INSTITUTE OF TECHNOLOGY</div>
                  <div className="paper-sub">DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING</div>
                  <div className="paper-meta-row">
                    <span>Course: Internet of Things (BCS701)</span>
                    <span className="tabular">Max Marks: {assessmentType === 'SEE' ? 100 : 40}</span>
                  </div>

                  <div className="paper-rule">PART A (Answer Any ONE Full Question: Q1 OR Q2 - 20 Marks)</div>
                  <div className="paper-question-item">
                    <span className="pq-code tabular">Q1(a)</span>
                    <span className="pq-text">Explain key characteristics of IoT with neat functional blocks.</span>
                    <span className="pq-marks tabular">[10M, CO1, L2]</span>
                  </div>
                  <div className="paper-question-item">
                    <span className="pq-code tabular">Q1(b)</span>
                    <span className="pq-text">Describe physical and logical design of IoT devices and link protocols.</span>
                    <span className="pq-marks tabular">[10M, CO1, L2]</span>
                  </div>
                  <div className="paper-or-divider">------- OR -------</div>
                  <div className="paper-question-item">
                    <span className="pq-code tabular">Q2(a)</span>
                    <span className="pq-text">Draw and explain generic block diagram of an IoT device with interfaces.</span>
                    <span className="pq-marks tabular">[10M, CO1, L3]</span>
                  </div>
                  <div className="paper-question-item">
                    <span className="pq-code tabular">Q2(b)</span>
                    <span className="pq-text">Discuss IoT enabling technologies including 6LoWPAN, WSN, and Cloud.</span>
                    <span className="pq-marks tabular">[10M, CO1, L2]</span>
                  </div>

                  <div className="paper-rule">PART B (Answer Any ONE Full Question: Q3 OR Q4 - 20 Marks)</div>
                  <div className="paper-question-item">
                    <span className="pq-code tabular">Q3(a)</span>
                    <span className="pq-text">Differentiate between IoT and M2M with architectural comparison.</span>
                    <span className="pq-marks tabular">[10M, CO2, L3]</span>
                  </div>
                  <div className="paper-question-item">
                    <span className="pq-code tabular">Q3(b)</span>
                    <span className="pq-text">Explain limitations of SNMP that make it unsuitable for IoT systems management.</span>
                    <span className="pq-marks tabular">[10M, CO2, L2]</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TOOL 3: DIAGNOSTIC QUIZ & ASSIGNMENT BUILDER */}
        {activeTool === 'quiz' && (
          <div className="studio-tool-panel">
            <div className="panel-left">
              <div className="panel-badge-bar">
                <span className="tool-type-badge">Tool 3: Formative Assessment</span>
                <span className="accent-tag">Risk Remediation</span>
              </div>
              <h3>Generate Diagnostic Quiz & Assignment</h3>
              <p className="panel-desc">
                Creates targeted micro-quizzes and homework assignments addressing student weak topics 
                diagnosed by the ML Failure Risk & XAI engine.
              </p>
              
              <div className="input-group">
                <label>Focus Weak Topics (Auto-Diagnosed from Ingested Marks)</label>
                <select 
                  value={selectedWeakTopic} 
                  onChange={(e) => {
                    setSelectedWeakTopic(e.target.value);
                    setSelectedOption(null);
                  }}
                >
                  <option value="snmp">Module 2: SNMP Limitations & System Management (High Failure Risk)</option>
                  <option value="sdn">Module 2: Conventional Network vs SDN/NFV Architecture</option>
                  <option value="m2m">Module 2: IoT vs M2M Communication Gateways</option>
                  <option value="logical">Module 1: IoT Functional Block Diagram (Logical Design)</option>
                </select>
              </div>

              <div className="studio-meta-box">
                <div className="meta-item">
                  <span className="meta-label">Target Audience:</span>
                  <span className="meta-val meta-risk">At-Risk Students (Tier-3 CIE)</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Format:</span>
                  <span className="meta-val">Concept Check MCQs + Grounded Rationales</span>
                </div>
              </div>

              <button 
                type="button"
                className="studio-primary-action-btn"
                disabled={isPublishingQuiz}
                onClick={handlePublishQuiz}
              >
                {isPublishingQuiz ? (
                  <>
                    <span className="btn-spinner"></span>
                    <span>Publishing to Student Portal...</span>
                  </>
                ) : (
                  <>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polygon points="5 3 19 12 5 21 5 3"></polygon>
                    </svg>
                    <span>Publish Diagnostic Quiz to Student Portal</span>
                  </>
                )}
              </button>
            </div>

            <div className="panel-right preview-stub">
              <div className="preview-header-bar">
                <span className="preview-indicator">
                  <span className="indicator-dot"></span> Interactive Student View Preview
                </span>
                <span className="preview-format-tag">Self-Correction Mode</span>
              </div>

              <div className="preview-placeholder">
                <div className="quiz-mockup">
                  <div className="quiz-header-row">
                    <span className="quiz-tag">Diagnostic Question 1</span>
                    <span className="quiz-co-badge">CO2 • RBT L2</span>
                  </div>

                  {selectedWeakTopic === 'snmp' ? (
                    <>
                      <p className="quiz-stem">
                        Why is Simple Network Management Protocol (SNMP) considered largely inadequate 
                        for automated configuration in large-scale IoT deployments?
                      </p>
                      <div className="quiz-options-list">
                        <div 
                          className={`quiz-opt ${selectedOption === 'A' ? 'selected' : ''}`}
                          onClick={() => setSelectedOption('A')}
                        >
                          <span className="opt-key tabular">A</span>
                          <span>It operates strictly over TCP and introduces excess connection setup overhead.</span>
                        </div>
                        <div 
                          className={`quiz-opt ${selectedOption === 'B' ? 'selected' : ''}`}
                          onClick={() => setSelectedOption('B')}
                        >
                          <span className="opt-key tabular">B</span>
                          <span>It lacks native transaction rollback (ACID) and uses connectionless UDP.</span>
                        </div>
                        <div 
                          className={`quiz-opt ${selectedOption === 'C' ? 'selected' : ''}`}
                          onClick={() => setSelectedOption('C')}
                        >
                          <span className="opt-key tabular">C</span>
                          <span>It requires XML payloads that cannot be parsed by embedded edge nodes.</span>
                        </div>
                      </div>

                      {selectedOption === 'B' && (
                        <div className="quiz-explanation-box correct">
                          <strong>✓ Correct Answer: Option B</strong>
                          <p>
                            Grounded in Module 2 Section 2.6: SNMP relies on stateless UDP transport without receipt 
                            acknowledgments and cannot execute multi-device atomic transactions, making NETCONF/YANG preferred.
                          </p>
                        </div>
                      )}
                      {selectedOption && selectedOption !== 'B' && (
                        <div className="quiz-explanation-box incorrect">
                          <strong>✗ Incorrect</strong>
                          <p>
                            Review Module 2 Section 2.6: SNMP operates over UDP (port 161/162), not TCP or XML, and lacks transaction management.
                          </p>
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="quiz-stem">
                        In Software-Defined Networking (SDN) for IoT, what is the primary function of the OpenFlow protocol?
                      </p>
                      <div className="quiz-options-list">
                        <div 
                          className={`quiz-opt ${selectedOption === 'A' ? 'selected' : ''}`}
                          onClick={() => setSelectedOption('A')}
                        >
                          <span className="opt-key tabular">A</span>
                          <span>Connects the centralized controller with network switches (Southbound interface).</span>
                        </div>
                        <div 
                          className={`quiz-opt ${selectedOption === 'B' ? 'selected' : ''}`}
                          onClick={() => setSelectedOption('B')}
                        >
                          <span className="opt-key tabular">B</span>
                          <span>Acts as a physical radio transceiver protocol replacing IEEE 802.15.4.</span>
                        </div>
                      </div>

                      {selectedOption === 'A' && (
                        <div className="quiz-explanation-box correct">
                          <strong>✓ Correct Answer: Option A</strong>
                          <p>
                            Module 2 Section 2.4.1: OpenFlow is the standardized Southbound communication interface allowing the centralized controller to modify switch flow tables.
                          </p>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
