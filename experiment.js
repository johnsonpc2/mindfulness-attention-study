//// We will first define all the things we'll use, and then we will push them to the timeline so they will be executed when subjects start the experiment

// First, we need to initialize jsPsych to run with Pavlovia
const pavlovia_init = {
  type: jsPsychPavlovia,
  command: "init"
};

// And we will also need to close everything when we're done
const pavlovia_finish = {
  type: jsPsychPavlovia,
  command: "finish"
};

// This initializes jsPsych itself
const jsPsych = initJsPsych({
  minimum_valid_rt: 200,
  on_finish: function() {
    // Calculate proportion correct for visual search trials
    var visual_search_trials = jsPsych.data.get().filter({type: jsPsychVisualSearchCircle});
    var correct_trials = visual_search_trials.filter({correct: true});
    var proportion_correct = correct_trials.count() / visual_search_trials.count();
    
    // Calculate average response time for visual search trials
    var average_rt = visual_search_trials.select('rt').mean();
    
    // Calculate average RT per block
    var average_rt_per_block = {};
    for (var block = 0; block < NumBlocks; block++) {
      var block_trials = visual_search_trials.filter({block: block});
      if (block_trials.count() > 0) {
        average_rt_per_block['block_' + block + '_avg_rt'] = block_trials.select('rt').mean();
      }
    }
    
    // Process mindfulness survey responses
    var mindfulness_data = jsPsych.data.get().filter({phase: 'mindfulness_survey'}).values();
    if (mindfulness_data.length > 0) {
      var mindfulness_responses = mindfulness_data[0].response;
      Object.keys(mindfulness_responses).forEach(key => {
        jsPsych.data.get().filter({phase: 'mindfulness_survey'}).values()[0][key] = mindfulness_responses[key];
      });
    }
    
    // Process satisfaction survey responses
    var satisfaction_data = jsPsych.data.get().filter({phase: 'satisfaction_survey'}).values();
    if (satisfaction_data.length > 0) {
      var satisfaction_responses = satisfaction_data[0].response;
      Object.keys(satisfaction_responses).forEach(key => {
        jsPsych.data.get().filter({phase: 'satisfaction_survey'}).values()[0][key] = satisfaction_responses[key];
      });
    }
    
    // Process Big 5 survey responses
    var big5_data = jsPsych.data.get().filter({phase: 'big5_survey'}).values();
    if (big5_data.length > 0) {
      var big5_responses = big5_data[0].response;
      Object.keys(big5_responses).forEach(key => {
        jsPsych.data.get().filter({phase: 'big5_survey'}).values()[0][key] = big5_responses[key];
      });
    }
    
    // Process demographics - age
    var age_data = jsPsych.data.get().filter({phase: 'demographics_survey'}).values();
    if (age_data.length > 0) {
      age_data[0].age = age_data[0].response.age;
    }
    
    // Process demographics - gender
    var gender_data = jsPsych.data.get().filter({phase: 'demographics_gender'}).values();
    if (gender_data.length > 0) {
      gender_data[0].gender_selected = gender_data[0].response.gender ? gender_data[0].response.gender.join(', ') : '';
    }
    
    // Process demographics - gender other
    var gender_other_data = jsPsych.data.get().filter({phase: 'demographics_gender_other'}).values();
    if (gender_other_data.length > 0) {
      gender_other_data[0].gender_other_text = gender_other_data[0].response.gender_other;
    }
    
    // Process demographics - race
    var race_data = jsPsych.data.get().filter({phase: 'demographics_race'}).values();
    if (race_data.length > 0) {
      race_data[0].race_selected = race_data[0].response.race;
    }
    
    // Add summary statistics to last trial
    jsPsych.data.get().addToLast({
      total_visual_search_trials: visual_search_trials.count(),
      correct_visual_search_trials: correct_trials.count(),
      proportion_correct: proportion_correct,
      average_rt: average_rt,
      ...average_rt_per_block
    });
  }
});

// Define the stimuli in their own object
const image_files = [
  'images/Blue_Circle.png',
  'images/Blue_Triangle.png',
  'images/Red_Circle.png',
  'images/Red_Triangle.png',
  'images/fixation_cross.png'
];

// Store the stimuli in their own objects for easier reference later
var blue_circle = image_files[0];
var blue_triangle = image_files[1];
var red_circle = image_files[2];
var red_triangle = image_files[3];
var fixation_cross = image_files[4];

// Create empty arrays to fill with the timeline and the visual search exposure task
const timeline = [];
var exposure = [];

// These are the basic settings for how the visual search task blocks will be constructed
var NumBlocks = 3;
var BreakSlide = 2; // Insert a break slide after every X blocks
var StimSetSize = [3, 6, 9];
var Target = ['present', 'absent'];

// red_blue_mix as an array of all the distractors
var red_blue_mix = [red_circle, blue_circle, blue_triangle];
var Distractor = [red_circle, blue_triangle, red_blue_mix];
var DistractorNames = ['red_circle', 'blue_triangle', 'red_blue_mix'];

// This isn't strictly necessary, but it serves as a small attention check just to make sure they haven't totally tuned out... I'm also extra.
// Available keys for break slides (excluding f and j which are used for the task)
var available_keys = ['a', 'b', 'c', 'd', 'e', 'g', 'h', 'i', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z'];
var shuffled_keys = jsPsych.randomization.sampleWithoutReplacement(available_keys, available_keys.length);
var key_index = 0;

// Create trials for each block
for (var block = 0; block < NumBlocks; block++) {
  var block_trials = [];
  
  // Create all factorial combinations for this block
  for (var i = 0; i < StimSetSize.length; i++) {
    for (var j = 0; j < Target.length; j++) {
      for (var k = 0; k < Distractor.length; k++) {
        
        // Build the stimuli array based on condition
        var stimuli = [];
        
        // Add the red triangle target if it is a "present" trial
        if (Target[j] === 'present') {
          stimuli.push(red_triangle);
        }
        
        // Add distractors to fill up to the set size
        var num_distractors = Target[j] === 'present' ? StimSetSize[i] - 1 : StimSetSize[i];
        
        // Handle red_blue_mix differently (it's an array)
        if (Array.isArray(Distractor[k])) {
          for (var d = 0; d < num_distractors; d++) {
            // Randomly pick from red or blue circle/triangle for mixed condition
            var random_distractor = Distractor[k][Math.floor(Math.random() * Distractor[k].length)];
            stimuli.push(random_distractor);
          }
        } else {
          for (var d = 0; d < num_distractors; d++) {
            stimuli.push(Distractor[k]);
          }
        }
        
        var trial = {
          type: jsPsychVisualSearchCircle,
          stimuli: stimuli,
          fixation_image: fixation_cross,
          fixation_duration: 1500,
          target_present: Target[j] === 'present',
          target_present_key: 'f',
          target_absent_key: 'j',
          target_size: [400, 400],
          data: {
            set_size: StimSetSize[i],
            distractor_type: DistractorNames[k],
            block: block,
            phase: "visual_search_trial",
            stimuli_list: stimuli.slice()  // Save a copy of the stimuli array
            }
        };
        
        block_trials.push(trial);
      }
    }
  }
  
  // Keep shuffling until no consecutive trials have the same distractor type
  var hasConsecutive = true;
  while (hasConsecutive) {
    block_trials = jsPsych.randomization.shuffle(block_trials);
    hasConsecutive = false;
    
    // Check if any consecutive trials have the same distractor type
    for (var i = 0; i < block_trials.length - 1; i++) {
      if (block_trials[i].data.distractor_type === block_trials[i + 1].data.distractor_type) {
        hasConsecutive = true;
        break;
      }
    }
  }
  
  // Add to main exposure array
  exposure = exposure.concat(block_trials);
  
  // Add a break slide after every BreakSlide blocks (but not after the last block)
  if ((block + 1) % BreakSlide === 0 && block < NumBlocks - 1) {
    var break_key_lower = shuffled_keys[key_index];
    var break_key_upper = break_key_lower.toUpperCase();
    key_index++;
    
    var break_slide = {
      type: jsPsychHtmlKeyboardResponse,
      stimulus: `<p>Great job so far! Please rest for a few seconds before continuing.</p>
                 <p>Press the <strong>${break_key_upper}</strong> key on your keyboard to continue.</p>`,
      choices: [break_key_lower],
      data: {
        phase: 'break',
        break_key: break_key_upper
      }
    };
    
    exposure.push(break_slide);
  }
}

console.log('Total trials:', exposure.length);

const consent = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="max-width: 900px; margin: 0 auto; padding: 20px; text-align: left; line-height: 1.6;">
      <h1 style="text-align: center; color: #333; font-size: 24px; margin-bottom: 10px;">
        Informed Consent for Research Participation
      </h1>
      <div style="text-align: center; font-size: 20px; color: #555; margin-bottom: 30px; font-style: italic;">
        The Effects of Mindfulness and Attention on Life Satisfaction and Memory
      </div>
      
      <p style="margin-bottom: 15px;"><strong>University at Albany, State University of New York<br>
      Department of Psychology</strong></p>

      <div style="background-color: #e8f5e9; border-left: 4px solid #4CAF50; padding: 20px; margin: 20px 0;">
        <h2 style="margin-top: 0; color: #2e7d32; font-size: 20px;">Key Information</h2>
        <p style="margin-bottom: 10px;"><strong>What is this study about?</strong> This study explores whether paying attention to the present moment (mindfulness) is related to how satisfied people feel with their lives and the capacity to direct attentional resources to the world around you.</p>
        <p style="margin-bottom: 10px;"><strong>What will I do?</strong> You will complete an anonymous online survey about your daily attention, mindfulness, and life satisfaction. This includes a visual search task, questionnaires about mindfulness and life satisfaction, personality measures, and demographic questions.</p>
        <p style="margin-bottom: 10px;"><strong>How long will it take?</strong> Approximately 45 minutes in one sitting.</p>
        <p style="margin-bottom: 10px;"><strong>What are the risks?</strong> Minimal risk - no greater than everyday life. You may experience mild discomfort when reflecting on your mindfulness or life satisfaction, and potential eye strain from electronic device use.</p>
        <p style="margin-bottom: 10px;"><strong>What will I receive?</strong> You will receive 1 SONA credit for your participation upon completion of the study.</p>
        <p style="margin-bottom: 10px;"><strong>Is participation required?</strong> No. Participation is completely voluntary and you may withdraw at any time without penalty.</p>
      </div>

      <h2 style="color: #555; font-size: 20px; margin-top: 30px; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px;">
        Researchers and Contact Information
      </h2>
      <p style="margin-bottom: 10px;"><strong>Principal Investigator:</strong> Ella M. Bremmer, Undergraduate Student, Department of Psychology, University at Albany<br>
      Email: ebremmer@albany.edu</p>
      
      <p style="margin-bottom: 10px;"><strong>Co-Principal Investigator:</strong> Pierce Johnson, Graduate Assistant, Department of Psychology, University at Albany<br>
      Email: pjohnson4@albany.edu</p>

      <p style="margin-bottom: 15px;"><strong>Faculty Advisor:</strong> Gregory Cox, PhD, Assistant Professor, Department of Psychology, University at Albany<br>
      Email: gecox@albany.edu</p>

      <h2 style="color: #555; font-size: 20px; margin-top: 30px; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px;">
        Purpose of the Study
      </h2>
      <p style="margin-bottom: 15px;">Have you ever wondered if being more mindful and paying attention to the present moment could help improve your life satisfaction and ability to focus your attention? This study will explore whether practicing mindfulness and staying aware in everyday life are associated with greater feelings of life satisfaction and attentional control.</p>
      
      <p style="margin-bottom: 15px;">Your responses will help researchers understand how mindfulness and attention may relate to overall well-being in college students. The results of this study will help us learn about how mindfulness may be related to experiences at both a large scale (life satisfaction) and small scale (visual attention). By bridging this gap between life satisfaction and basic cognitive mechanisms, our study will help inform mental health professionals, educators, and individuals looking for simple, everyday ways to support their happiness and mental health.</p>

      <h2 style="color: #555; font-size: 20px; margin-top: 30px; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px;">
        Study Procedures
      </h2>
      <p style="margin-bottom: 10px;"><strong>What you will be asked to do:</strong></p>
      <ul style="margin: 10px 0; padding-left: 25px;">
        <li style="margin-bottom: 8px;">Complete a visual search task where you will view displays of simple colored shapes and decide whether each display contains a designated "target" object (e.g., a red triangle). The displays will vary in the number of shapes shown and how the objects differ from the target.</li>
        <li style="margin-bottom: 8px;">Complete the Mindfulness Attention Awareness Scale (MAAS) - questions about how often you pay attention to the present moment</li>
        <li style="margin-bottom: 8px;">Complete the Satisfaction With Life Scale (SWLS) - questions about how satisfied you feel with your life</li>
        <li style="margin-bottom: 8px;">Complete the Big 5 Inventory - questions about personality traits</li>
        <li style="margin-bottom: 8px;">Answer demographic questions (e.g., age, gender, race/ethnicity, student status)</li>
      </ul>
      
      <p style="margin-bottom: 15px;"><strong>Time commitment:</strong> Study participation will take approximately 45 minutes and must be completed in one sitting at a time of your choosing. All study procedures will take place online through the Pavlovia platform.</p>
      
      <p style="margin-bottom: 15px;"><strong>Requirements:</strong> You must be at least 18 years old and currently enrolled at UAlbany. You must be able to read and understand English. We ask that you complete the study in a quiet environment to minimize distractions. You may take breaks while completing the survey to reduce the risk of eye strain associated with the use of electronic devices.</p>

      <h2 style="color: #555; font-size: 20px; margin-top: 30px; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px;">
        Risks and Discomforts
      </h2>
      <p style="margin-bottom: 10px;">The risks associated with this study are minimal and no greater than those you might encounter in everyday life. Potential risks include:</p>
      <ul style="margin: 10px 0; padding-left: 25px;">
        <li style="margin-bottom: 8px;">Mild discomfort when answering questions reflecting on your mindfulness or life satisfaction</li>
        <li style="margin-bottom: 8px;">Potential eye strain from using electronic devices (you may take breaks as needed)</li>
        <li style="margin-bottom: 8px;">Minimal risk of confidentiality breach (see Confidentiality section below for mitigation steps)</li>
      </ul>
      
      <p style="margin-bottom: 15px;">To minimize these risks, you will be clearly informed that you can withdraw from the study at any time without any consequences. You are encouraged to take breaks during the survey as needed.</p>

      <h2 style="color: #555; font-size: 20px; margin-top: 30px; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px;">
        Benefits
      </h2>
      <p style="margin-bottom: 15px;">There is no direct personal benefit to you from participating in this research besides earning SONA credit. However, some participants may find value in reflecting on their own mindfulness, attention, and its impact on life satisfaction through completing this survey.</p>
      
      <p style="margin-bottom: 15px;">The information gathered in this study may help advance society's understanding of how mindfulness and attention relate to overall well-being, potentially informing future programs or interventions aimed at improving student mental health and life satisfaction.</p>

      <h2 style="color: #555; font-size: 20px; margin-top: 30px; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px;">
        Compensation
      </h2>
      <p style="margin-bottom: 15px;">Participation in this study will involve no cost to you. You will receive 1 SONA credit in exchange for your participation. SONA credit will be awarded promptly after you complete the survey, via the SONA system.</p>
      
      <p style="margin-bottom: 15px;"><strong>Important:</strong> Participants who withdraw before completing the survey will not receive credit. You must complete the study to earn SONA credit. Students who choose not to participate in this study will have the opportunity to participate in other studies on the SONA site for credit, or complete assignments assigned by course instructors to earn research credit.</p>

      <h2 style="color: #555; font-size: 20px; margin-top: 30px; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px;">
        Confidentiality and Data Management
      </h2>
      <p style="margin-bottom: 15px;"><strong>Protection of your identity:</strong> All responses will be anonymous. We will not collect any identifying information or link your name or identity with your responses. To minimize risks to confidentiality, all information collected throughout the study is de-identified.</p>
      
      <p style="margin-bottom: 15px;"><strong>Data storage:</strong> All data will be collected anonymously via jsPsych/Pavlovia, which both use encryption to protect information. Only the student researcher (Ella Bremmer), graduate student mentor (Pierce Johnson), and faculty advisor (Gregory Cox) will have password-protected access to the data. Data will be stored on secure, university-approved devices. Data will be retained for five years following the completion of the study, in accordance with university policies.</p>
      
      <p style="margin-bottom: 15px;"><strong>Future use of data:</strong> The anonymous dataset may be shared with authorized university personnel or collaborators for research purposes only, with no identifying information included. Before analyzing or sharing any data you provide, we will ensure that no identifying information is present. After identifiers are confirmed to be removed, the data could be used for future research studies or distributed to another investigator for future research studies without additional informed consent from you.</p>
      
      <p style="margin-bottom: 15px;"><strong>Data destruction:</strong> After the five-year retention period, all electronic data files will be permanently deleted and any physical materials destroyed to ensure confidentiality.</p>
      
      <p style="margin-bottom: 15px;"><strong>Identification in reports:</strong> You will not be identified in any reports or publications resulting from this research.</p>

      <h2 style="color: #555; font-size: 20px; margin-top: 30px; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px;">
        Voluntary Participation and Withdrawal
      </h2>
      <p style="margin-bottom: 10px;">Participation in this study is completely voluntary. You have the right to:</p>
      <ul style="margin: 10px 0; padding-left: 25px;">
        <li style="margin-bottom: 8px;">Decline to participate without any consequences</li>
        <li style="margin-bottom: 8px;">Skip any question you do not want to answer</li>
        <li style="margin-bottom: 8px;">Withdraw from the study at any time without penalty</li>
      </ul>
      
      <p style="margin-bottom: 15px;">Your decision to participate, not participate, or withdraw will not affect your class standing, grades, employment, or any other aspects of your relationship with the University at Albany.</p>

      <h2 style="color: #555; font-size: 20px; margin-top: 30px; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px;">
        Questions and Contact Information
      </h2>
      <div style="background-color: #f0f0f0; padding: 15px; border-left: 4px solid #4CAF50; margin: 20px 0;">
        <p style="margin-bottom: 10px;"><strong>Questions about the research:</strong></p>
        <p style="margin-bottom: 10px;">If you have questions about this study now or after participation, you may contact the researchers at:</p>
        <p style="margin-bottom: 15px;">Principal Investigator: ebremmer@albany.edu<br>
        Co-Principal Investigator: pjohnson4@albany.edu<br>
        Faculty Advisor: gecox@albany.edu</p>
        
        <p style="margin-bottom: 10px;"><strong>Questions about your rights as a research participant:</strong></p>
        <p style="margin-bottom: 10px;">If you have questions or concerns about your rights as a participant in this research, you may contact:</p>
        <p style="margin-bottom: 0;">Institutional Review Board<br>
        University at Albany<br>
        Office of Regulatory and Research Compliance<br>
        1400 Washington Ave, ES 244<br>
        Albany, NY 12222<br>
        Phone: 1-866-857-5459<br>
        Email: rco@albany.edu</p>
      </div>

      <div style="background-color: #f9f9f9; border: 2px solid #4CAF50; border-radius: 5px; padding: 20px; margin-top: 30px;">
        <h2 style="margin-top: 0; color: #555; font-size: 20px; border: none; padding: 0;">Statement of Consent</h2>
        <p style="margin-bottom: 15px;">I have read this form and the research study has been explained to me. I have been given sufficient opportunity to consider whether to participate and to ask questions. I have been provided with contact information for the researchers and the IRB if I have additional questions. I understand that:</p>
        <ul style="margin: 10px 0 20px 25px; padding: 0;">
          <li style="margin-bottom: 8px;">My participation is voluntary</li>
          <li style="margin-bottom: 8px;">I may withdraw at any time without penalty</li>
          <li style="margin-bottom: 8px;">My responses will be kept confidential and anonymous</li>
          <li style="margin-bottom: 8px;">My data may be used for future research after identifiers are removed</li>
          <li style="margin-bottom: 8px;">I must complete the study to earn SONA credit</li>
          <li style="margin-bottom: 8px;">I am at least 18 years old</li>
        </ul>
        <p style="margin-bottom: 15px; font-weight: bold;">By clicking "I Agree" below, I confirm that I agree to participate in the research study described above.</p>
      </div>
    </div>
  `,
  choices: ['I Agree', 'I Do Not Agree'],
  data: {
    phase: 'informed_consent'
  },
  on_finish: function(data) {
    // Record which button was pressed (0 = I Agree, 1 = I Do Not Agree)
    data.consented = data.response === 0;
  }
};

// Add this conditional check after the consent trial
const consent_check = {
  timeline: [
    {
      type: jsPsychHtmlButtonResponse,
      stimulus: '<p>You have declined to participate in this study. Thank you for your time.<br><br>Redirecting back to SONA...</p>',
      choices: [],
      trial_duration: 500,
      on_finish: function() {
        window.location.href = 'https://albany.sona-systems.com/';
      }
    }
  ],
  conditional_function: function() {
    // Get the data from the last trial (consent)
    const last_trial = jsPsych.data.get().last(1).values()[0];
    // Only run this timeline if they did NOT consent
    return last_trial.response === 1;
  }
};

// Generate a random key for this participant
var randomKey = jsPsych.randomization.sampleWithReplacement(['f', 'j'], 1)[0];
var keyDisplay = randomKey;

// General task instructions
var initial_instructions = {
  type: jsPsychInstructions,
  pages: [
    `<p style="font-size:4vw">Welcome!</p><br><br><p style="font-size:1.5vw">Thanks for reading and agreeing to the consent form. In this study you will complete two tasks: First, you will complete a visual search task where we ask you to indicate if a shape is present amongst other shapes. After completing the visual search task, you will complete a questionnaire about yourself, how mindful you are, and your life satisfaction. The study takes about 40-45 minutes to complete. All responses will remain anonymous.</p><br><br><p style="font-size:1.5vw; font-weight:bold; color:#2196F3;">To continue, press the ${keyDisplay} key when you are ready to beign.</p>`
  ],
  show_clickable_nav: false,
  key_forward: randomKey,
  allow_backward: false,
  allow_keys: true,
  data: {
    phase: 'intro_instructions',
    required_key: randomKey
  }
};

var vs_instructions = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `<p>Press F if there is a red triangle in the group.</p>
    <p>Press J if there is no red triangle in the group.</p>`,
  choices: ['Continue'],
  data: {
    phase: 'vs_instructions'
  }
};

var likert_scale = [
  "Almost Always", 
  "Very Frequently", 
  "Somewhat Frequently", 
  "Somewhat Infrequently", 
  "Very Infrequently",
  "Almost Never",
];

var mindfulness_survey = {
  type: jsPsychSurveyLikert,
  questions: [
    {prompt: "I could experiencing some emotion and not be concious of it until some time later.", name: 'Emotion', labels: likert_scale},
    {prompt: "I break or spill things because of carelessness, not paying attention, or thinking of something else.", name: 'Carelessness', labels: likert_scale},
    {prompt: "I find it difficult to stay focused on whats happening in the present.", name: 'Focus', labels: likert_scale},
    {prompt: "I tend to walk quickly to get where I'm going without paying attention to what I experience along the way.", name: 'Walking', labels: likert_scale},
    {prompt: "I tend not to notice feelings of physical tension or discomfort until they really grab my attention.", name: 'Feelings', labels: likert_scale},
    {prompt:"I forget a person's name almost as soon as I've been told it for the first time.", name: 'Names', labels: likert_scale},
    {prompt:"It seems I am 'running on automatic,' without much awareness of what I'm doing.", name: 'Automatic', labels: likert_scale},
    {prompt:"I rush through activities without being really attentive to them.", name: 'Rush', labels: likert_scale},
    {prompt:"I get so focused on the goal I want to achieve that I lose touch with what I'm doing right now to get there.", name: 'Now', labels: likert_scale},
    {prompt:"I do jobs or tasks automatically, without being aware of what I'm doing.", name: 'Tasks', labels: likert_scale},
    {prompt:"I find myself listening to someone with one ear, doing something else at the same time.", name: 'Multitasking', labels: likert_scale},
    {prompt:"I drive places on 'automatic pilot' and then wonder why I went there.", name: 'Driving', labels: likert_scale},
    {prompt:"I find myself preoccupied with the future or the past.", name: 'Preoccupied', labels: likert_scale},
    {prompt:"I find myself doing things without paying attention.", name: 'Attention', labels: likert_scale},
    {prompt:"I snack without being aware that I'm eating.", name: 'Eat', labels: likert_scale}],
    randomize_question_order: true,
    scale_width: window.innerWidth * 0.7,
    data: {
    phase: 'mindfulness_survey'
  }
};

var Satisfaction_Survey = {
  type: jsPsychSurveyLikert,
  questions: [
    {prompt: "In most ways my life is close to my ideal.", name: 'Ideal', labels: likert_scale},
    {prompt: "The conditions of my life are excellent.", name: 'Conditions', labels: likert_scale},
    {prompt: "I am satisfied with my life", name: 'Satisfied', labels: likert_scale},
    {prompt: "So far I have gotten the important things I want in life.", name: 'Important', labels: likert_scale},
    {prompt: "If I could live my life over, I would change almost nothing.", name: 'Change', labels: likert_scale}],
    randomize_question_order: true,
    scale_width: window.innerWidth * 0.7,
    data: {
    phase: 'satisfaction_survey'
  }
};
var Big_5_survey = {
  type: jsPsychSurveyLikert,
  preamble: "<p>Here are a number of characteristics that may or may not apply to you. For example, do you agree that you are someone who likes to spend time with others? Please indicate for each statement the extent to which you agree or disagree with that statement.</p>" + "<p>I see myself as someone who...</p>",
  questions: [
    {prompt: "Is talkative", name: 'Talkative', labels: likert_scale},
    {prompt: "Tends to find fault with others", name: 'Fault', labels: likert_scale},
    {prompt: "Does a thorough job", name: 'Thorough', labels: likert_scale},
    {prompt: "Is depressed, blue", name: 'Depressed', labels: likert_scale},
    {prompt: "Is originial, comes up with new ideas", name: 'Original', labels: likert_scale},
    {prompt: "Is reserved", name: 'Reserved', labels: likert_scale},
    {prompt: "Is helpful and unselfish with others", name: 'Unselfish', labels: likert_scale},
    {prompt: "Can be somewhat careless", name: 'Careless', labels: likert_scale},
    {prompt: "Is relaxed, handles stress well", name: 'relaxed', labels: likert_scale},
    {prompt: "Is curious about many different things", name: 'Curious', labels: likert_scale},
    {prompt: "Is full of energy", name: 'Energetic', labels: likert_scale},
    {prompt: "Starts quarrels with others ", name: 'Quarrels', labels: likert_scale},
    {prompt: "Is a reliable worker", name: 'Reliable', labels: likert_scale},
    {prompt: "Can be tense", name: 'Tense', labels: likert_scale},
    {prompt: "Is ingenious, a deep thinker", name: 'Ingenious', labels: likert_scale},
    {prompt: "Generates a lot of enthusiasm", name: 'Enthusiastic', labels: likert_scale},
    {prompt: "Has a forgiving nature", name: 'Forgiving', labels: likert_scale},
    {prompt: "Tends to be disorganized", name: 'Disorganzied', labels: likert_scale},
    {prompt: "Worries a lot", name: 'Worries', labels: likert_scale},
    {prompt: "Has an active imagination", name: 'imagination', labels: likert_scale},
    {prompt: "Tends to be quiet", name: 'quiet', labels: likert_scale},
    {prompt: "Is generally trusting", name: 'trusting', labels: likert_scale},
    {prompt: "Tends to be lazy", name: 'Lazy', labels: likert_scale},
    {prompt: "Is emotionally stable, not easily upset", name: 'stable', labels: likert_scale},
    {prompt: "Is inventive", name: 'inventive', labels: likert_scale},
    {prompt: "Has an assertive personality", name: 'Assertive', labels: likert_scale},
    {prompt: "Can be cold and aloof", name: 'aloof', labels: likert_scale},
    {prompt: "Perseveres unti the task is finished", name: 'perservere', labels: likert_scale},
    {prompt: "Can be moody", name: 'moody', labels: likert_scale},
    {prompt: "Values artistic, aesthetic experiences", name: 'aesthetic', labels: likert_scale},
    {prompt: "Is sometimes shy, inhibited", name: 'shy', labels: likert_scale},
    {prompt: "Is considerate and kind to almost everyone", name: 'kind', labels: likert_scale},
    {prompt: "Does things efficiently", name: 'Efficient', labels: likert_scale},
    {prompt: "Remains calm in tense situations", name: 'calm', labels: likert_scale},
    {prompt: "Prefers work that is routine", name: 'routine', labels: likert_scale},
    {prompt: "Is outgoingm sociable", name: 'social', labels: likert_scale},
    {prompt: "Is sometimes rude to others", name: 'rude', labels: likert_scale},
    {prompt: "Makes plans and follows through with them", name: 'plans', labels: likert_scale},
    {prompt: "Gets nervous easily", name: 'Nervous', labels: likert_scale},
    {prompt: "Likes to reflect, play with ideas", name: 'reflect', labels: likert_scale},
    {prompt: "Has few artistic interest", name: 'artistic', labels: likert_scale},
    {prompt: "Is full of energy", name: 'Energetic', labels: likert_scale},
    {prompt: "likes to cooperate with others", name: 'cooperate', labels: likert_scale},
    {prompt: "Is easily distracted", name: 'distracted', labels: likert_scale},
    {prompt: "Is sophisticated in art, music, or literature", name: 'sophisticated', labels: likert_scale}
    ],
    scale_width: window.innerWidth * 0.7,
    data: {
    phase: 'big5_survey'
  }
    };

// Demographics survey: a block for entering age, gender, and race
var demographics_age = {
  type: jsPsychSurveyText,
  questions: [{
    prompt: '<p style=font-size:1.5vw>Please enter your age in numerals (e.g., "24")</p>',
    name: 'age',
    required: true
  }],
  data: {
    phase: 'demographics_survey'
  }
};

// Age check - redirect if under 18
const age_check = {
  timeline: [
    {
      type: jsPsychHtmlButtonResponse,
      stimulus: '<p style="font-size:1.5vw">Thank you for your interest in this study. However, participation is restricted to individuals 18 years of age or older.<br><br>You will not receive SONA credit for this incomplete session.<br><br>Redirecting back to SONA...</p>',
      choices: [],
      trial_duration: 5000,
      on_finish: function() {
        window.location.href = 'https://albany.sona-systems.com/';
      }
    }
  ],
  conditional_function: function() {
    // Get the data from the age question
    const age_data = jsPsych.data.get().filter({phase: 'demographics_survey'}).last(1).values()[0];
    const age = parseInt(age_data.response.age);
    // Redirect if age is less than 18
    return age < 18;
  }
};

var demographics_gender = {
  type: jsPsychSurveyMultiSelect,
  questions: [{
    prompt: '<p style=font-size:1.5vw>Which of the following gender identities best describes you? Please select all that apply.</p>',
    name: 'gender',
    options: [
      "Woman",
      "Man",
      "Transgender Woman",
      "Transgender Man",
      "Non-binary/gender non-conforming",
      "Other",
      "Prefer not to say"],
    required: true,
    vertical: true
  }],
  data: {
    phase: 'demographics_gender'
  }
};

var demographics_gender_other = {
  type: jsPsychSurveyText,
  questions: [{
    prompt: '<p style=font-size:1.5vw>If you selected "Other", please specify. If you chose another option please answer "N/A"</p>',
    name: 'gender_other',
    required: true,
    vertical: true
  }],
  data: {
    phase: 'demographics_gender_other'
  }
};

var demographics_race = {
  type: jsPsychSurveyMultiChoice,
  questions: [{
    prompt: '<p style=font-size:1.5vw>Which of the following best describes you?</p>',
    name: 'race',
    options: [
      "Asian or Pacific Islander",
      "Black or African American",
      "Hispanic or Latino",
      "Indigenous or Native American",
      "White or Caucasian",
      "Multiracial"],
    required: true,
    vertical: true
  }],
  data: {
    phase: 'demographics_race'
  }
};

// Debriefing redirects people to the Sona login page
var debriefing_mindfulness = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `
    <div style="max-width: 900px; margin: 0 auto; padding: 20px; text-align: left; line-height: 1.6;">
      <h1 style="text-align: center; color: #333; font-size: 24px; margin-bottom: 10px;">
        Study Debriefing
      </h1>
      <div style="text-align: center; font-size: 20px; color: #555; margin-bottom: 30px; font-style: italic;">
        The Effects of Mindfulness and Attention on Life Satisfaction and Memory
      </div>

      <div style="background-color: #e3f2fd; border-left: 4px solid #2196F3; padding: 20px; margin: 20px 0;">
        <h2 style="margin-top: 0; color: #1976d2; font-size: 20px;">Thank You for Participating!</h2>
        <p style="margin-bottom: 0;">We appreciate your time and effort in completing this study. Your participation helps us better understand the relationship between mindfulness, attention, and well-being.</p>
      </div>

      <h2 style="color: #555; font-size: 20px; margin-top: 30px; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px;">
        Study Purpose
      </h2>
      <p style="margin-bottom: 15px;">The purpose of this study was to examine the relationship between attention, mindfulness, and life satisfaction. Specifically, we wanted to explore whether:</p>
      <ul style="margin: 10px 0 15px 25px; padding: 0;">
        <li style="margin-bottom: 8px;">Greater levels of mindfulness (awareness of the present moment) are associated with better attentional control</li>
        <li style="margin-bottom: 8px;">Mindfulness and attention are related to overall life satisfaction</li>
        <li style="margin-bottom: 8px;">These relationships hold across people with different levels of conscientiousness</li>
      </ul>

      <h2 style="color: #555; font-size: 20px; margin-top: 30px; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px;">
        What We Learned from Your Participation
      </h2>
      <p style="margin-bottom: 15px;">The visual search task you completed measures your ability to focus attention and efficiently locate target objects among distractors. This basic cognitive ability may be related to mindfulness practices in everyday life.</p>
      
      <p style="margin-bottom: 15px;">The questionnaires you completed help us understand your typical level of mindfulness, your satisfaction with life, and your personality characteristics (most importantly, conscientiousness). By combining data from the visual search task with your survey responses, we can examine how mindfulness and attention may relate to experiences at both a large scale (life satisfaction) and small scale (visual attention).</p>

      <h2 style="color: #555; font-size: 20px; margin-top: 30px; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px;">
        How Your Data Will Be Used
      </h2>
      <p style="margin-bottom: 15px;">Your anonymous responses will be combined with data from other participants to identify patterns and relationships between mindfulness, attention, and life satisfaction. The results may:</p>
      <ul style="margin: 10px 0 15px 25px; padding: 0;">
        <li style="margin-bottom: 8px;">Help inform mental health professionals about the potential benefits of mindfulness practices</li>
        <li style="margin-bottom: 8px;">Contribute to educational programs that support student well-being</li>
        <li style="margin-bottom: 8px;">Advance our understanding of how everyday awareness relates to cognitive functioning</li>
        <li style="margin-bottom: 8px;">Be published in peer-reviewed scientific journals and presented at academic conferences</li>
      </ul>

      <h2 style="color: #555; font-size: 20px; margin-top: 30px; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px;">
        Confidentiality Reminder
      </h2>
      <p style="margin-bottom: 15px;">All of your responses are completely anonymous, and your data has been assigned a random ID number that we cannot trace back to you. We cannot and will not link your identity to your data in any way. Your privacy is protected throughout all stages of data analysis, storage, and potential publication.</p>

      <h2 style="color: #555; font-size: 20px; margin-top: 30px; border-bottom: 2px solid #e0e0e0; padding-bottom: 8px;">
        Questions or Concerns?
      </h2>
      <div style="background-color: #f0f0f0; padding: 15px; border-left: 4px solid #2196F3; margin: 20px 0;">
        <p style="margin-bottom: 10px;">If you have any questions about this study or would like to learn about the results when they become available, please feel free to contact:</p>
        <p style="margin-bottom: 15px;">
          <strong>Principal Investigator:</strong> Ella M. Bremmer<br>
          Email: ebremmer@albany.edu<br><br>
          <strong>Co-Principal Investigator:</strong> Pierce Johnson<br>
          Email: pjohnson4@albany.edu<br><br>
          <strong>Faculty Advisor:</strong> Gregory Cox, PhD<br>
          Email: gecox@albany.edu
        </p>
        
        <p style="margin-bottom: 10px;">If you have questions about your rights as a research participant, you may contact:</p>
        <p style="margin-bottom: 0;">
          Institutional Review Board<br>
          University at Albany<br>
          Phone: 1-866-857-5459<br>
          Email: rco@albany.edu
        </p>
      </div>

      <div style="background-color: #fff3cd; border: 2px solid #ffc107; border-radius: 5px; padding: 20px; margin-top: 30px;">
        <h2 style="margin-top: 0; color: #856404; font-size: 18px;">Receiving Your SONA Credit</h2>
        <p style="margin-bottom: 10px; color: #856404;">By clicking "Complete Study" below, you will:</p>
        <ul style="margin: 10px 0 15px 25px; padding: 0; color: #856404;">
          <li style="margin-bottom: 8px;">Finalize your participation in this study</li>
          <li style="margin-bottom: 8px;">Be redirected to SONA to receive your research credit</li>
          <li style="margin-bottom: 8px;">Have your participation recorded in the SONA system</li>
        </ul>
        <p style="margin-bottom: 0; font-weight: bold; color: #856404;">Thank you again for your valuable contribution to psychological research!</p>
      </div>
    </div>
  `,
  choices: ['Complete Study'],
  data: {
    phase: 'debriefing'
  }
};

//// Now that we've defined everything, we can start pushing things to the timeline that subjects will see

// First, we push the initialization to the timeline to kick everything off
timeline.push(pavlovia_init);

// Then we need them to go thorugh the consent form
timeline.push(consent);

timeline.push(consent_check);

// Preload images now, so they don't lag later
timeline.push({
  type: jsPsychPreload,
  images: image_files,
  data: {
    phase: 'image_preload'
  }
});

// Overall task instructions
timeline.push(initial_instructions);

// Add demographics
timeline.push(demographics_age);
timeline.push(age_check);
timeline.push(demographics_gender);
timeline.push({
  timeline: [demographics_gender_other],
  conditional_function: function() {
    var data = jsPsych.data.get().filter({phase: 'demographics_gender'}).last(1).values()[0];
    return data.response.gender && data.response.gender.includes('Other');
  }
});
timeline.push(demographics_race);

timeline.push({
  type: jsPsychHtmlKeyboardResponse,
  stimulus: '<p style="font-size:4vw">Visual Search Task</p>',
  choices: 'NO_KEYS',
  trial_duration: 2000,
  response_ends_trial: false,
  data: {
    phase: 'intermediate_slide_VS'
  }
});

// Visual search instructions
timeline.push(vs_instructions);
timeline.push(...exposure);  // Spread the visual search exposure array

// Add surveys

timeline.push({
  type: jsPsychHtmlKeyboardResponse,
  stimulus: "<p style='font-size:2.5vw'>You've finished the visual search. Next is the mindfulness survey.</p>",
  choices: 'NO_KEYS',
  trial_duration: 4000,
  response_ends_trial: false,
  data: {
    phase: 'intermediate_slide_mindfulness'
  }
});

timeline.push(mindfulness_survey);

timeline.push({
  type: jsPsychHtmlKeyboardResponse,
  stimulus: "<p style='font-size:2.5vw'>You've finished the mindfulness survey. Next is the life satisfaction questionnaire.</p>",
  choices: 'NO_KEYS',
  trial_duration: 4000,
  response_ends_trial: false,
  data: {
    phase: 'intermediate_slide_ls'
  }
});

timeline.push(Satisfaction_Survey);

timeline.push({
  type: jsPsychHtmlKeyboardResponse,
  stimulus: "<p style='font-size:2.5vw'>You've finished the satisfaction questionnaire. The last survey is a personality questionnaire.</p>",
  choices: 'NO_KEYS',
  trial_duration: 4000,
  response_ends_trial: false,
  data: {
    phase: 'intermediate_slide_personality'
  }
});

timeline.push(Big_5_survey);

timeline.push(debriefing_mindfulness);

timeline.push(pavlovia_finish);

// Runs the timeline we created with all the code we've put on it
jsPsych.run(timeline);
console.log(timeline);
