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
});

const image_files = [
  'images/Blue_Circle.png',
  'images/Blue_Triangle.png',
  'images/Red_Circle.png',
  'images/Red_Triangle.png',
  'images/fixation_cross.png'
];

const timeline = []; // Creates empty array to fill with procedure

var red_circle = image_files[2];
var red_triangle = image_files[3];
var blue_circle = image_files[0];
var blue_triangle = image_files[1];
var fixation_cross = image_files[4];

var exposure = [];
var NumBlocks = 20;
var StimSetSize = [3, 6, 9];
var Target = ['present', 'absent'];

// red_blue_mix as an array of the variables
var red_blue_mix = [red_circle, blue_circle];
var Distractor = [red_circle, blue_triangle, red_blue_mix];
var DistractorNames = ['red_circle', 'blue_triangle', 'red_blue_mix'];

// Create trials for each block
for (var block = 0; block < NumBlocks; block++) {
  var block_trials = [];
  
  // Create all factorial combinations for this block
  for (var i = 0; i < StimSetSize.length; i++) {
    for (var j = 0; j < Target.length; j++) {
      for (var k = 0; k < Distractor.length; k++) {
        
        // Build the stimuli array based on condition
        var stimuli = [];
        
        // Add target if present
        if (Target[j] === 'present') {
          stimuli.push(red_triangle);
        }
        
        // Add distractors to fill up to the set size
        var num_distractors = Target[j] === 'present' ? StimSetSize[i] - 1 : StimSetSize[i];
        
        // Handle red_blue_mix differently (it's an array)
        if (Array.isArray(Distractor[k])) {
          for (var d = 0; d < num_distractors; d++) {
            // Randomly pick from red or blue circle for mixed condition
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
          target_present_key: 'e',
          target_absent_key: 'n',
          target_size: [350, 350],
          data: {
            set_size: StimSetSize[i],
            distractor_type: DistractorNames[k],
            block: block
          }
        };
        
        block_trials.push(trial);
      }
    }
  }
  
  // Randomize trials within this block
  block_trials = jsPsych.randomization.shuffle(block_trials);
  
  // Add to main exposure array
  exposure = exposure.concat(block_trials);
}
console.log('Total trials:', exposure.length);

var instructions = {
  type: jsPsychHtmlButtonResponse,
  stimulus: `<p>Press E if there is a red triangle in the group.</p>
    <p>Press N if there is no red triangle in the group.</p>`,
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
    {prompt:"It seems I am "running on automatic," without much awareness of what I'm doing.", name: 'Automatic', labels: likert_scale},
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
timeline.push(instructions);
timeline.push(...exposure);  // Spread the exposure array

// Add surveys
timeline.push(mindfulness_survey);
timeline.push(Satisfaction_Survey);

// Add demographics
timeline.push(demographics_age);
timeline.push(demographics_gender);
timeline.push(demographics_gender_other);
timeline.push(demographics_race);

timeline.push(pavlovia_finish);

// Runs the timeline we created with all the code we've put on it
jsPsych.run(timeline);
console.log(timeline);
