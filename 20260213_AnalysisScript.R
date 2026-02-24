
# Script:      AnalysisScript
# Author:      Pierce C. Johnson
# Created:     20260213
# Description: Analysis of data from the Mindfulness and Attention Study, run
#   Spring 2026.
#
# Shortcuts:
#   alt + shift + k: shortcut guide
#   alt + o:         collapse all sections
#   alt + shift + o: expand all sections
#   ctrl + alt + t:  run code section


# Setup -----------------------------------------------------------------------

# First we need to install useful packages from GitHub
devtools::install_github(
  repo = "johnsonpc2/pcjtools",
  upgrade = "always",
  force = FALSE
)

devtools::install_github(
  repo = "bcdudek/bcdstats",
  upgrade = "never",
  force = FALSE
)

# And then we can actually load packages we'll use later
pcjtools::load_packages(c("bcdstats", "car", "data.table", "emmeans",
                          "ggplot2", "gtsummary", "lme4", "pcjtools","psych"))

# Pull new data files from Pavlovia. BE CAREFUL, make sure this function pulls
# from the correct gitlab repository
pavlovia_pull()

# Not strictly necessary, but I clean the workspace before I do anything
clean_workspace(confirm = FALSE)


# Read In Data ----------------------------------------------------------------

# Gather list of all data files in the "data" folder of the project directory
files_info(path = "./data", extension = ".csv") -> data_files

# Import the raw data from the files
import_data(x = data_files$filepath) -> raw_data


# Clean Data ------------------------------------------------------------------

local({

  # Filter to just demographic trials; keep ID, phase, and response columns
  raw_data[
    phase %like% "demographics",
    list(sona_id, phase, response)
  ] -> demo_temp

  # Filter subjects (we lose 10 total data files)
  demo_temp[!sona_id %in% c(
    78409, 78958, 79098, # multiple attempts (2, 2, 3)
    79251, # no age; multiple attempts (2)
    79283, # not English proficient (1)
    78921 # > 10% of trial RTs were >2 SDs from the grand mean (1)
    )] -> demo_temp2

  # Widen the responses to wide format so each subject only has one line
  widen_responses(DT = demo_temp2) -> demo_temp3

  # Make age a numeric variable so we can calculate summary stats
  demo_temp3[, `:=`(age = as.numeric(age))] -> demo_temp3

  # Save the list of subjects IDs to keep
  demo_temp3[ , sona_id] -> demo_temp4

  # Gender Summary Table
  gtsummary::tbl_summary(
    data = demo_temp3,
    include = "gender"
  ) -> demo_temp5

  # Race Summary Table
  gtsummary::tbl_summary(
    data = demo_temp3,
    include = "race"
  ) -> demo_temp6

  # Age Summary Stats
  describe(x = demo_temp3$age, fast = TRUE) -> demo_temp7

  # Store all the demo info in a list so its in one place
  results <- list(
    "demographics" = demo_temp3,
    "subjects to keep" = demo_temp4,
    "gender" = demo_temp5,
    "race" = demo_temp6,
    "age" = demo_temp7
  )

}) -> demo_data


# Visual Search Analysis ------------------------------------------------------

local({

  # Make a dataset of only the Visual Search data
  raw_data[sona_id %in% demo_data$`subjects to keep` &
             phase == "visual_search_trial",
           list(sona_id, phase, block, distractor_type, target_present,
                stimuli_list, rt, response, correct)
           ][, `:=`(rt = as.numeric(rt),
                    block = block + 1,
                    set_size = lengths(strsplit(gsub('\\[|\\]|"', '', stimuli_list), ",")))
             ][, stimuli_list := NULL] -> vs_data

  # Calculate the mean RT and p. correct for every condition for each subject
  # (Here we collapse across blocks)
  vs_data[, list(prop_correct = mean(correct),
                 avg_rt = mean(rt)),
          by = list(sona_id, distractor_type,
                    target_present, set_size, correct)
          ] -> vs_collapsed

  # Calculate each subjects' p. accuracy > .80
  vs_collapsed[, list(total_conditions = .N,
                    n_low_accuracy = sum(prop_correct < 0.80),
                    prop_low_accuracy = mean(prop_correct < 0.80)),
             by = sona_id
             ] -> vs_accuracy

  results <- list(
    "vs_data" = vs_data,
    "vs_collapsed" = vs_collapsed,
    "vs_accuracy" = vs_accuracy
  )

}) -> vs_data

# glmer(
#   rt ~ distractor_type * target_present * set_size +
#     (1 | sona_id),
#   data = vs_data$vs_data[correct == TRUE],
#   family = Gamma(link = "log")
# ) -> fit
#
# summary(fit)
#
# Anova(fit, type = 3)
#
# # Main effect of set_size
# emmeans(fit, pairwise ~ set_size, adjust = "bonferroni", type = "response")
#
# # Interaction: set_size within each level of target_present
# emmeans(fit, pairwise ~ set_size | target_present, adjust = "bonferroni", type = "response")
#
# glmer(
#   rt ~ distractor_type * target_present * set_size +
#     (distractor_type + target_present + set_size | sona_id),
#   data = vs_data$vs_data[correct == TRUE],
#   family = Gamma(link = "log")
# ) -> mid_fit
#
# summary(mid_fit)
#
# tbl_regression(mid_fit, exponentiate = TRUE)

explore(
  x = vs_data$vs_collapsed$avg_rt,
  varname = "Avg RT"
)

local({

  # Calculate grand mean and SD of RT across all trials
  grand_mean_rt <- mean(vs_data$vs_data$rt, na.rm = TRUE)
  grand_sd_rt <- sd(vs_data$vs_data$rt, na.rm = TRUE)

  # Calculate upper threshold (2 SDs above mean)
  threshold_upper <- grand_mean_rt + (2 * grand_sd_rt)

  # Calculate lower threshold (2 SDs below mean)
  threshold_lower <- grand_mean_rt - (2 * grand_sd_rt)

  # Flag trials that are outliers (outside 2 SDs)
  vs_data$vs_data[,
    is_outlier := (rt > threshold_upper) | (rt < threshold_lower)
  ]

  # Calculate proportion of outlier trials per participant
  vs_data$vs_data[,
    list(
      n_trials = .N,
      n_outliers = sum(is_outlier, na.rm = TRUE),
      prop_outliers = mean(is_outlier, na.rm = TRUE)
    ),
    by = sona_id
  ] -> outlier_summary

  # Get participants with high outlier rates (e.g., > 10%)
  outlier_summary[prop_outliers > 0.10] -> high_outlier_participants

}) -> outliers

# Plot and save the accuracy and RT data for the visual search
local({

  ggplot(
    data = vs_data$vs_collapsed,
    mapping = aes(
      x = set_size,
      y = prop_correct,
      color = factor(
        x = target_present,
        labels = c("Absent", "Present")),
      shape = correct
    )
  ) +
    stat_summary(
      fun.data = mean_cl_boot,
      position = position_dodge(width = 0.5)
    ) +
    facet_wrap(~distractor_type,
               labeller = as_labeller(
                 c(`blue_triangle` = "Blue Triangle",
                   `red_blue_mix` = "Red/Blue Mix",
                   `red_circle` = "Red Circle")
               )) +
    scale_x_continuous(breaks = c(3, 6, 9)) +
    scale_y_continuous(limits = c(0, 1)) +
    labs(
      title = "Accuracy High Across All Conditions:",
      subtitle = "No Set Size or Conjunction Effects",
      y = "pCorrect",
      x = "Set Size"
    ) +
    guides(
      color = guide_legend(title = "Target")
    ) +
    theme_pcj(
      legend.position = c(0.95, 1.1),
      legend.key.spacing.x = unit(.5, 'in')
    ) -> acc_plot

  ggplot(
    data = vs_data$vs_collapsed[correct == TRUE],
    mapping = aes(
      x = set_size,
      y = avg_rt,
      color = factor(
        x = target_present,
        labels = c("Absent", "Present"))
    )
  ) +
    stat_summary(
      fun.data = mean_cl_boot,
      position = position_dodge(width = 0.75),
      size = .75,
      linewidth = .75
    ) +
    facet_wrap(~distractor_type,
               labeller = as_labeller(
                 c(`blue_triangle` = "Blue Triangle",
                   `red_blue_mix` = "Red/Blue Mix",
                   `red_circle` = "Red Circle")
               )) +
    scale_x_continuous(breaks = c(3, 6, 9)) +
    scale_y_continuous(limits = c(0, 3500)) +
    labs(
      title = "Slow Correct Decisions when Target Absent:",
      subtitle = "Set Size and Conjunction Effects",
      y = "Average RT (ms)",
      x = "Set Size"
    ) +
    guides(
      color = guide_legend(title = "Target")
    ) +
    theme_pcj(
      legend.position = c(0.95, 1.1),
      legend.key.spacing.x = unit(.5, 'in')
      ) -> rt_plot

  plot_results <- list(
    "vs_accuracy" = acc_plot,
    "vs_rt" = rt_plot
  )

}) -> vs_data$vs_plots


plot_saver(
  plots = vs_data$vs_plots,
  dir = "./plots",
  names = names(vs_data$vs_plots),
  dpi = 600,
  preview = FALSE,
  width = 15.3,
  height = 8.9
  )


# Survey Analysis -------------------------------------------------------------

local({

  raw_data[
    sona_id %in% demo_data$`subjects to keep` &
      phase %like% "survey",
    list(sona_id, phase, response)
  ] -> survey_temp

  widen_responses(DT = survey_temp, prefix = "phase") -> survey_temp2

  recode_cols(dt = survey_temp2, cols = 2:65, class = "numeric") -> survey_temp3

  melt(
    data = survey_temp3,
    id.vars = "sona_id",
    variable.name = "Measure",
    value.name = "item_score"
  ) -> survey_temp4

  # Recode from 0-4 scale to 1-5 scale
  survey_temp4[, item_score := item_score + 1]

  # Define Conscientiousness items and reverse-coded items
  conscientiousness_items <- c(
    "big5_survey_Thorough",
    "big5_survey_Careless",
    "big5_survey_Reliable",
    "big5_survey_Disorganzied",
    "big5_survey_Lazy",
    "big5_survey_perservere",
    "big5_survey_Efficient",
    "big5_survey_plans",
    "big5_survey_distracted"
  )

  reverse_items <- c(
    "big5_survey_Careless",
    "big5_survey_Disorganzied",
    "big5_survey_Lazy",
    "big5_survey_distracted"
  )

  # Create recoded score column
  survey_temp4[
    Measure %in% reverse_items,
    item_score_recoded := 6 - item_score
  ][
    !(Measure %in% reverse_items),
    item_score_recoded := item_score
  ]

  # Calculate subscale scores
  survey_temp4[
    Measure %like% "mindfulness",
    score := mean(x = item_score, na.rm = TRUE),
    by = "sona_id"
  ][
    Measure %like% "satisfaction",
    score := sum(x = item_score, na.rm = TRUE),
    by = "sona_id"
  ][
    Measure %in% conscientiousness_items,
    score := sum(x = item_score_recoded, na.rm = TRUE),
    by = "sona_id"
  ] -> survey_temp5

  # Get one row per person per subscale
  survey_temp5[
    Measure %like% "mindfulness",
    .(Measure = "mindfulness", score = unique(score)),
    by = "sona_id"
  ] -> mindfulness_scores

  survey_temp5[
    Measure %like% "satisfaction",
    .(Measure = "satisfaction", score = unique(score)),
    by = "sona_id"
  ] -> satisfaction_scores

  survey_temp5[
    Measure %in% conscientiousness_items,
    .(Measure = "conscientiousness", score = unique(score)),
    by = "sona_id"
  ] -> conscientiousness_scores

  # Combine all scores
  rbind(
    mindfulness_scores,
    satisfaction_scores,
    conscientiousness_scores
    ) -> survey_scores

  dcast(
    data = survey_scores,
    formula = sona_id ~ Measure,
    value.var = "score"
  )

}) -> survey_data


# Combined Dataset --------------------------------------------------------

merge(
  x = vs_data$vs_collapsed,
  y = survey_data,
  by = "sona_id",
  all.x = TRUE
  ) -> full_data

local({

  # Mindfulness plot
  ggplot(
    data = full_data[!is.na(mindfulness)],
    mapping = aes(
      x = mindfulness,
      y = avg_rt
    )
  ) +
    geom_point(alpha = 0.5, size = 2) +
    geom_smooth(method = "lm", se = TRUE) +
    scale_y_continuous(limits = c(0, 3500)) +
    labs(
      title = "Response Time by Mindfulness Score",
      subtitle = "Relationship between mindfulness and visual search RT",
      y = "Average RT (ms)",
      x = "Mindfulness Score"
    ) +
    theme_pcj(
      legend.position = c(0.95, 1.1),
      legend.key.spacing.x = unit(.5, 'in')
    ) -> mindfulness_rt_plot

  # Life Satisfaction plot
  ggplot(
    data = full_data[!is.na(satisfaction)],
    mapping = aes(
      x = satisfaction,
      y = avg_rt,
      color = factor(
        x = target_present,
        labels = c("Absent", "Present")
      )
    )
  ) +
    geom_point(alpha = 0.5, size = 2) +
    geom_smooth(method = "lm", se = TRUE) +
    facet_wrap(~distractor_type,
               labeller = as_labeller(
                 c(`blue_triangle` = "Blue Triangle",
                   `red_blue_mix` = "Red/Blue Mix",
                   `red_circle` = "Red Circle")
               )) +
    scale_y_continuous(limits = c(0, 3500)) +
    labs(
      title = "Response Time by Life Satisfaction Score",
      subtitle = "Relationship between satisfaction and visual search RT",
      y = "Average RT (ms)",
      x = "Life Satisfaction Score"
    ) +
    guides(
      color = guide_legend(title = "Target")
    ) +
    theme_pcj(
      legend.position = c(0.95, 1.1),
      legend.key.spacing.x = unit(.5, 'in')
    ) -> satisfaction_rt_plot

  # Conscientiousness plot
  ggplot(
    data = full_data[!is.na(conscientiousness)],
    mapping = aes(
      x = conscientiousness,
      y = avg_rt,
      color = factor(
        x = target_present,
        labels = c("Absent", "Present")
      )
    )
  ) +
    geom_point(alpha = 0.5, size = 2) +
    geom_smooth(method = "lm", se = TRUE) +
    facet_wrap(~distractor_type,
               labeller = as_labeller(
                 c(`blue_triangle` = "Blue Triangle",
                   `red_blue_mix` = "Red/Blue Mix",
                   `red_circle` = "Red Circle")
               )) +
    scale_y_continuous(limits = c(0, 3500)) +
    labs(
      title = "Response Time by Conscientiousness Score",
      subtitle = "Relationship between conscientiousness and visual search RT",
      y = "Average RT (ms)",
      x = "Conscientiousness Score"
    ) +
    guides(
      color = guide_legend(title = "Target")
    ) +
    theme_pcj(
      legend.position = c(0.95, 1.1),
      legend.key.spacing.x = unit(.5, 'in')
    ) -> conscientiousness_rt_plot

  ggplot(
    data = full_data,
    mapping = aes(
      x = mindfulness,
      y = satisfaction
    )
  ) +
    geom_smooth(method = "lm", se = TRUE) +
    geom_point() -> mind_sat

  ggplot(
    data = full_data,
    mapping = aes(
      x = mindfulness,
      y = conscientiousness
    )
  ) +
    geom_smooth(method = "lm", se = TRUE) +
    geom_point() -> mind_con

  # Add to your plot results list
  plot_results <- list(
    "mindfulness_rt" = mindfulness_rt_plot,
    "satisfaction_rt" = satisfaction_rt_plot,
    "conscientiousness_rt" = conscientiousness_rt_plot,
    "mindfulness_satisfaction" = mind_sat,
    "mindfulness_conscientiousness" = mind_con
  )

}) -> survey_rt_plots


# Backup to GitHub ------------------------------------------------------------

git_push(push = TRUE)
