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
