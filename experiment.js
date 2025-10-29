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
    
    // Add to data
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
var NumBlocks = 20;
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
                 <p>Press the <strong>${break_key_upper}</strong> button on your keyboard to continue.</p>`,
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
    
    // If participant does not consent, redirect to SONA
    if (data.response === 1) {
      // Redirect to SONA immediately
      window.location.href = 'https://albany.sona-systems.com/';
    }
  }
};

var instructions = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `<p>Press F if there is a red triangle in the group.</p>
    <p>Press J if there is no red triangle in the group.</p>`,
  choices: ['Continue']
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
    randomize_question_order: true
};

var Satisfaction_Survey = {
  type: jsPsychSurveyLikert,
  questions: [
    {prompt: "In most ways my life is close to my ideal.", name: 'Ideal', labels: likert_scale},
    {prompt: "The conditions of my life are excellent.", name: 'Conditions', labels: likert_scale},
    {prompt: "I am satisfied with my life", name: 'Satisfied', labels: likert_scale},
    {prompt: "So far I have gotten the important things I want in life.", name: 'Important', labels: likert_scale},
    {prompt: "If I could live my life over, I would change almost nothing.", name: 'Change', labels: likert_scale}],
    randomize_question_order: true
};

// Demographics survey: a block for entering age, gender, and race
var demographics_age = {
  type: jsPsychSurveyText,
  questions: [{
    prompt: '<p style=font-size:1.5vw>Please enter your age in numerals (e.g., "24")</p>',
    name: 'age',
    required: false
  }],
  data: {
    phase: 'demographics_survey'
  },
  on_finish: function(data){
    data.response = JSON.stringify(data.response.age);
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
    required: false,
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
    required: false,
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
    required: false,
    vertical: true
  }],
  data: {
    phase: 'demographics_race'
  }
};

//// Now that we've defined everything, we can start pushing things to the timeline that subjects will see

// First, we push the initialization to the timeline to kick everything off
timeline.push(pavlovia_init);

// Add this to your timeline
timeline.push(consent);

// Preload images
timeline.push({
  type: jsPsychPreload,
  images: image_files,
  data: {
    phase: 'image_preload'
  }
});

// General task instructions
timeline.push({
  type: jsPsychInstructions,
  pages: [
    '<p style="font-size:4vw">Welcome!</p><br><br><p style="font-size:1.5vw">Thanks for reading and agreeing to the consent form. In this study you will complete two tasks: First, you will complete a visual search task where we ask you to indicate if a shape is present amongst other shapes. After completing the visual search task, you will complete a questionnaire about yourself, how mindful you are, and your life satisfaction. The study takes about 40-45 minutes to complete. All responses will remain anonymous.</p>'],
  button_label_next: 'Continue',
  button_label_previous: 'Go back',
  show_clickable_nav: true,
  data: {
    phase: 'intro_instructions'
  }
});

// Visual search task instructions
timeline.push(instructions);
timeline.push(...exposure);  // Spread the visual search exposure array

// Add surveys
timeline.push(mindfulness_survey);
timeline.push(Satisfaction_Survey);

// Add demographics
timeline.push(demographics_age);
timeline.push(demographics_gender);
timeline.push(demographics_gender_other);
timeline.push(demographics_race);

// Debriefing redirects people to the Sona login page
timeline.push({
  type: jsPsychInstructions,
  pages: [
    '<p style="font-size:1.5vw">Thank you for completing the study! Click "Continue" to move to the debriefing on the next page and receive credit for your participation.</p>',
    "<p style='font-size:1.5vw'>The researcher's goal is to examine the relationship between attention, mindfulness, and life satisfaction. With the data you have provided, we will be able to see, for example, if greater levels of attention and higher mindfulness are related with life satisfaction. If you have any questions, please contact the researcher (ebremmer@albany.edu or pjohnson4@albany.edu).</p>",
    '<p style="font-size:1.5vw">By hitting the "Continue" button on this page, you will complete the study and indication of your participation will be sent to the Sona pool so you earn credit for participating.</p>'],
  button_label_next: 'Continue',
  button_label_previous: 'Go back',
  show_clickable_nav: true,
  data: {
    phase: 'debriefing'
  }
});

timeline.push(pavlovia_finish);

// Runs the timeline we created with all the code we've put on it
jsPsych.run(timeline);
console.log(timeline);
