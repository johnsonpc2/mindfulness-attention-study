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

// Preload images
timeline.push({
  type: jsPsychPreload,
  images: image_files,
  data: {
    phase: 'image_preload'
  }
});

// Put the instructions and visual search trials here
// Informed Consent
timeline.push({
  type: jsPsychInstructions,
  pages: [// Each new item in the list shows up on a new page
    "<p style='font-size:1.5vw'>We are researchers at the University at Albany in the Department of Psychology, conducting a research study in which we now invite you to take part. <br><br>The following pages have important information about this study's purpose, what we will ask you to do if you decide to participate, and the way we would like to use the information we gather if you choose to be in the study.</p>",
    "<p style='font-size:1.5vw'>You are being asked to participate in a research study about music and people's hearing ability. The purpose of this study is to investigate what people prefer and remember about music. Your participation will help us better understand what people notice about music and how people gather and remember information about what they experience in general. <br><br>You will listen to music for about 30 minutes, and then will be asked questions about what you heard. Then, you will answer demographic questions about yourself and share basic information about your hearing. All responses will be anonymous, and we will not collect any data linking your name or identity with your data. <br><br>You will be provided with our contact information in case you have any questions about our research.</p>",
    "<p style='font-size:1.5vw'>Study participation will take place at a time of your choosing. Once you begin, you will need to complete the study in one sitting. Participation will take approximately 45 minutes. All study procedures will take place online. <br><br>We ask that you complete the study in a quiet environment to minimize distractions. You will have to listen to music throughout this study, please complete the study with headphones or earbuds so you can clearly hear the music played in your web browser.</p>",
    "<p style='font-size:1.5vw'>The risks associated with this study are no greater than those you might encounter in everyday life. You may experience mild emotional discomfort answering questions about your identity. <br><br>Music will play in your browser throughout the study, and you will be warned in advance to lower the volume of your computer so you don't experience hearing discomfort.<br><br> As with all research, there is a chance that confidentiality of the information we collect from you could be breached; we will take steps to minimize this risk, as discussed in more detail below.</p>",
    "<p style='font-size:1.5vw'>To minimize the risks to confidentiality, we de-identify all information collected throughout the study. We may share the data we collect from you for use in future research studies or with other researchers; before analyzing any data you provide, we will remove any personally identifiable information. Further, if we share the data you provide as part of this study, we will ensure you cannot be identified before we share it. All data will be stored on secure drives and will be analyzed on password protected computers.</p>",
    "<p style='font-size:1.5vw'>Participation in this study will involve no cost to you. You will receive 1 credit in extra course credit in exchange for your participation. <br><br>Though there is no direct benefit of taking part in this research besides earning extra credit in your course, the information gathered in this study will help us better understand how people learn from, remember, and form preferences of  their experiences.</p>",
    "<p style='font-size:1.5vw'>Participation in this study is voluntary. You do not have to answer any question you do not want to answer. If at any time you would like to stop participating, you are free to do so. You may withdraw from this study at any time, and you will not be penalized in any way for deciding to stop participation. <br><br>You may choose not to participate or to stop participating in this research at any time. This will not affect your class standing, grades, employment, or any other aspects of your relationship with the University at Albany.</p>",
    "<p style='font-size:1.5vw'>If you have questions after participation in this study, you may contact the researchers at pjohnson4@albany.edu (PI), or gecox@albany.edu (Co-PI). <br><br>If you have any questions about your rights as a participant in this research, you can contact the following office at the University at Albany: <br><br>Institutional Review Board <br>University at Albany <br>Office of Regulatory and Research Compliance <br>1400 Washington Ave, ES 244 <br>Albany, NY 12222 <br>Phone: 1-866-857-5459 <br>Email: rco@albany.edu</p>",
    "<p style='font-size:1.5vw'>I have read this form and the research study has been explained to me. I have been given the opportunity to ask questions and my questions have been answered. If I have additional questions, I have been told whom to contact. By clicking the button below, I agree to participate in the research study described above.</p>"],
  button_label_next: 'Continue',
  button_label_previous: 'Go back',
  show_clickable_nav: true,
  data: {
    phase: 'informed_consent'
  } // Record extra data about the slide.
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
