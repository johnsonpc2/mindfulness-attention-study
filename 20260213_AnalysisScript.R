
# Script:      AnalysisScript
# Author:      Pierce C. Johnson
# Created:     20260213
# Modified:    20260227
# Description: Analyzes behavioral and survey data from the Mindfulness and
#   Attention Study (Spring 2026). Covers participant exclusions, visual search
#   RT/accuracy, and relationships between survey scores (mindfulness, life
#   satisfaction, conscientiousness) and search performance.
#
# Output:      Plots saved to ./plots; data backed up to GitHub
#
# Shortcuts:
#   alt + shift + k: shortcut guide
#   alt + o:         collapse all sections
#   alt + shift + o: expand all sections
#   ctrl + alt + t:  run code section


# NOTES -------------------------------------------------------------------

#   1. Add layer of points to the accuracy plot so you can see the distribution
#     of the data


# Setup -----------------------------------------------------------------------

# First we need to install useful packages from GitHub
devtools::install_github(
  repo = c("johnsonpc2/pcjtools", "bcdudek/bcdstats")
)

# Load all packages used in this script
pcjtools::load_packages(c(
  "bcdstats", "car", "data.table", "emmeans",
  "ggplot2", "gtsummary", "lme4", "pcjtools", "psych"
))

# Pull latest data files from the Pavlovia GitLab repository
git_pull(sleep = 5)

# Clear workspace before analysis
clean_workspace(confirm = FALSE)


# Read In Data ----------------------------------------------------------------

# Get list of all raw CSV files in the data folder, then import them
files_info(path = "./data", extension = ".csv") -> data_files
import_data(x = data_files$filepath) -> raw_data


# Clean Data ------------------------------------------------------------------

local({

  # Filter to just demographic trials; keep ID, phase, and response columns
  raw_data[
    phase %like% "demographics",
    list(sona_id, phase, response)
  ] -> demo_temp

  # Exclude subjects for the following reasons (13 subjects; 19 files):
  demo_temp[!sona_id %in% c(
    75815, 78593, 78958, 79098, # multiple attempts (2, 2, 2, 3)
    79251,                      # no age; multiple attempts (2)
    78848, 79283,               # not English proficient (2)
    78360, 78371, 78393, 78573, 78921, 79106  # outlier RT trials > 5% (6)
  )] -> demo_temp2

  # Check for duplicates
  # table(table(raw_data$sona_id) == 295)
  # View(raw_data[, .N, by = sona_id])

  # Reshape to wide format (one row per subject) and coerce age to numeric
  widen_responses(DT = demo_temp2) -> demo_temp3
  demo_temp3[, age := as.numeric(age)]

  # Save the retained subject IDs for use in downstream filtering
  demo_temp3[, sona_id] -> subject_ids

  # Summarize demographics
  gtsummary::tbl_summary(data = demo_temp3, include = "gender") -> gender_table
  gtsummary::tbl_summary(data = demo_temp3, include = "race")   -> race_table
  describe(x = demo_temp3$age, fast = TRUE)                     -> age_stats

  results <- list(
    "demographics"     = demo_temp3,
    "subjects to keep" = subject_ids,
    "gender"           = gender_table,
    "race"             = race_table,
    "age"              = age_stats
  )

}) -> demo_data


# Visual Search Analysis ------------------------------------------------------

local({

  # Build visual search dataset for retained subjects only
  raw_data[
    sona_id %in% demo_data$`subjects to keep` & phase == "visual_search_trial",
    list(sona_id, phase, block, distractor_type, target_present,
         stimuli_list, rt, response, correct)
  ][,
    `:=`(
      rt       = as.numeric(rt),
      block    = block + 1,
      set_size = lengths(strsplit(gsub('\\[|\\]|"', "", stimuli_list), ","))
    )
  ][, stimuli_list := NULL] -> vs_data

  # Flag outlier trials: those falling outside ±2 SDs of the grand mean RT
  grand_mean_rt <- mean(vs_data$rt, na.rm = TRUE)
  grand_sd_rt   <- sd(vs_data$rt,   na.rm = TRUE)

  vs_data[,
          is_outlier := rt > 5000 |
            rt < grand_mean_rt - (2 * grand_sd_rt)
  ]

  # Remove outlier trials before collapsing so avg_rt reflects clean trials only
  vs_data[is_outlier == FALSE] -> vs_data_clean

  # Collapse across blocks: compute mean RT and proportion correct per condition
  vs_data_clean[,
                list(
                  prop_correct = mean(correct),
                  avg_rt       = mean(rt)
                ),
                by = list(sona_id, distractor_type, target_present, set_size, correct)
  ] -> vs_collapsed

  collapsed_Gmean <- mean(vs_collapsed$avg_rt)
  collapsed_Gsd   <- sd(vs_collapsed$avg_rt)

  # Summarize outlier rate per participant; flag anyone exceeding 5%
  vs_data[,
          list(
            n_trials      = .N,
            n_outliers    = sum(is_outlier, na.rm = TRUE),
            prop_outliers = mean(is_outlier, na.rm = TRUE)
          ),
          by = sona_id
  ] -> outlier_summary

  # Summarize accuracy: flag conditions where p(correct) < .80
  vs_collapsed[,
               list(
                 total_conditions  = .N,
                 n_low_accuracy    = sum(prop_correct < 0.80),
                 prop_low_accuracy = mean(prop_correct < 0.80)
               ),
               by = sona_id
  ] -> vs_accuracy

  results <- list(
    "vs_data"          = vs_data,
    "vs_collapsed"     = vs_collapsed,
    "vs_accuracy"      = vs_accuracy,
    "outlier_summary"  = outlier_summary,
    "outlier_subjects" = outlier_summary[prop_outliers > 0.05],
    "grand_stats"      = list(gMean = grand_mean_rt, gSD = grand_sd_rt),
    "collapsed_stats"  = list(gMean = collapsed_Gmean, gSD = collapsed_Gsd)
  )

}) -> vs_data


# Step 1: Characterize the RT Pattern ----------------------------------------

# Prepare modelling data: correct trials only, factors set appropriately
vs_data$vs_collapsed[correct == TRUE][
  , `:=`(
    set_size_num    = as.numeric(set_size),
    distractor_type = factor(distractor_type),
    target_present  = factor(target_present)
  )
] -> rt_model_data

# Mixed model: all three within-subject factors with random intercepts by subject
rt_lmer <- lmer(
  avg_rt ~ set_size_num * distractor_type * target_present + (1 | sona_id),
  data = rt_model_data
)

# Overall fixed effects — which factors drive RT?
car::Anova(rt_lmer, type = 3)

# Follow-up: RT slope across set size within each distractor x target cell.
# Captures search efficiency per condition (ms added per additional item).
emtrends(
  rt_lmer,
  specs = ~ target_present | distractor_type,
  var   = "set_size_num"
) -> rt_trends

summary(rt_trends)


# Step 2: Per-subject Search Efficiency for Survey Correlations --------------

# Compute each person's RT slope across set sizes within each distractor_type.
# This gives one efficiency score per person per distractor condition,
# suitable for the faceted mindfulness plot below.
rt_model_data[
  ,
  .(slope = coef(lm(avg_rt ~ set_size_num))["set_size_num"]),
  by = .(sona_id, distractor_type)
] -> rt_slopes


# Visual Search Plots ---------------------------------------------------------

local({

  distractor_labels <- as_labeller(c(
    `blue_triangle` = "Blue Triangle",
    `red_blue_mix`  = "Red/Blue Mix",
    `red_circle`    = "Red Circle"
  ))

  # Accuracy plot
  ggplot(
    data    = vs_data$vs_collapsed,
    mapping = aes(
      x     = set_size,
      y     = prop_correct,
      color = factor(target_present, labels = c("Absent", "Present"))
    )
  ) +
    stat_summary(
      fun.data = mean_cl_boot,
      position = position_dodge(width = 0.5)
    ) +
    facet_wrap(~distractor_type, labeller = distractor_labels) +
    scale_x_continuous(breaks = c(3, 6, 9)) +
    scale_y_continuous(limits = c(0, 1)) +
    labs(
      title    = "Accuracy by Conditions:",
      subtitle = "No Set Size, Distractor, or Conjunction Effects",
      y        = "Proportion Correct",
      x        = "Set Size"
    ) +
    guides(color = guide_legend(title = "Target")) +
    theme_pcj(
      legend.position      = c(0.98, 1.1),
      legend.key.spacing.x = unit(.5, "in"),
      default_caption      = FALSE
    ) -> acc_plot

  # RT plot
  ggplot(
    data    = vs_data$vs_collapsed[correct == TRUE],
    mapping = aes(
      x     = set_size,
      y     = avg_rt,
      color = factor(target_present, labels = c("Absent", "Present"))
    )
  ) +
    stat_summary(
      fun.data  = mean_cl_boot,
      position  = position_dodge(width = 0.75),
      size      = .75,
      linewidth = .75
    ) +
    facet_wrap(~distractor_type, labeller = distractor_labels) +
    scale_x_continuous(breaks = c(3, 6, 9)) +
    scale_y_continuous(limits = c(0, vs_data$collapsed_stats$gMean +
                                    2 * vs_data$collapsed_stats$gSD)) +
    labs(
      title    = "Slow Correct Decisions when Target Absent:",
      subtitle = "Set Size and Conjunction Effects",
      y        = "Average RT (ms)",
      x        = "Set Size"
    ) +
    guides(color = guide_legend(title = "Target")) +
    theme_pcj(
      legend.position      = c(0.98, 1.1),
      legend.key.spacing.x = unit(.5, "in"),
      default_caption      = FALSE
    ) -> rt_plot

  plot_results <- list(
    "vs_accuracy" = acc_plot,
    "vs_rt"       = rt_plot
  )

}) -> vs_data$vs_plots

plot_saver(
  plots   = vs_data$vs_plots,
  dir     = "./plots",
  names   = names(vs_data$vs_plots),
  dpi     = 600,
  preview = FALSE,
  width   = 15.5,
  height  = 9
)


# Mixed Effects Models (Exploratory) ------------------------------------------
# NOTE: Not currently run. Kept for reference.

# glmer(
#   rt ~ distractor_type * target_present * set_size +
#     (1 | sona_id),
#   data   = vs_data$vs_data[correct == TRUE],
#   family = Gamma(link = "log")
# ) -> fit
#
# summary(fit)
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
#   data   = vs_data$vs_data[correct == TRUE],
#   family = Gamma(link = "log")
# ) -> mid_fit
#
# summary(mid_fit)
# tbl_regression(mid_fit, exponentiate = TRUE)


# Survey Analysis -------------------------------------------------------------

local({

  # Extract survey responses for retained subjects; reshape to wide format
  raw_data[
    sona_id %in% demo_data$`subjects to keep` & phase %like% "survey",
    list(sona_id, phase, response)
  ] -> survey_temp

  widen_responses(DT = survey_temp, prefix = "phase") -> survey_temp2

  # Recode all item columns to numeric and shift from 0–4 to 1–5 scale
  recode_cols(dt = survey_temp2, cols = 2:65, class = "numeric") -> survey_temp3

  melt(
    data          = survey_temp3,
    id.vars       = "sona_id",
    variable.name = "Measure",
    value.name    = "item_score"
  ) -> survey_temp4

  survey_temp4[, item_score := item_score + 1]

  # Define Conscientiousness items and which are reverse-coded
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

  # Reverse-score negatively-worded items (6 - score on a 1–5 scale)
  survey_temp4[
    Measure %in% reverse_items,
    item_score_recoded := 6 - item_score
  ][
    !(Measure %in% reverse_items),
    item_score_recoded := item_score
  ]

  # Compute subscale scores:
  #   Mindfulness:        mean of items; higher scores = lower negative affect
  #   Life Satisfaction:  sum of items; 5-35; average 20-24 (neutral)
  #   Conscientiousness:  mean of items, negatively-worded items reverse-scored
  survey_temp4[
    Measure %like% "mindfulness",
    score := mean(item_score, na.rm = TRUE),
    by = "sona_id"
  ][
    Measure %like% "satisfaction",
    score := sum(item_score, na.rm = TRUE),
    by = "sona_id"
  ][
    Measure %in% conscientiousness_items,
    score := mean(item_score_recoded, na.rm = TRUE),
    by = "sona_id"
  ] -> survey_temp5

  # Extract one score per person per subscale and combine into a single table
  list(
    survey_temp5[Measure %like% "mindfulness",
                 .(Measure = "mindfulness",       score = unique(score)), by = "sona_id"],
    survey_temp5[Measure %like% "satisfaction",
                 .(Measure = "satisfaction",      score = unique(score)), by = "sona_id"],
    survey_temp5[Measure %in% conscientiousness_items,
                 .(Measure = "conscientiousness", score = unique(score)), by = "sona_id"]
  ) |> rbindlist() -> survey_scores

  # Reshape to wide format: one row per subject with a column per subscale
  dcast(
    data      = survey_scores,
    formula   = sona_id ~ Measure,
    value.var = "score"
  )

}) -> survey_data


# Combined Dataset ------------------------------------------------------------

# Merge visual search and survey data on subject ID
merge(
  x     = vs_data$vs_collapsed,
  y     = survey_data,
  by    = "sona_id",
  all.x = TRUE
) -> vs_data$full_data

# Collapse to one row per subject per distractor_type x target_present.
# Filter to correct trials only (matching rt_model_data) before averaging,
# then average over set sizes so each subject contributes one RT per condition.
vs_data$full_data[
  correct == TRUE,
  .(
    avg_rt            = mean(avg_rt,            na.rm = TRUE),
    mindfulness       = mean(mindfulness,       na.rm = TRUE),
    satisfaction      = mean(satisfaction,      na.rm = TRUE),
    conscientiousness = mean(conscientiousness, na.rm = TRUE)
  ),
  by = .(sona_id, distractor_type, target_present)
] -> vs_data$full_data_subj

# One row per subject for subscale intercorrelation plots (no RT or condition)
vs_data$full_data_subj[
  ,
  .(
    mindfulness       = mean(mindfulness,       na.rm = TRUE),
    satisfaction      = mean(satisfaction,      na.rm = TRUE),
    conscientiousness = mean(conscientiousness, na.rm = TRUE)
  ),
  by = sona_id
] -> vs_data$subj_scores


# Survey × RT Plots -----------------------------------------------------------

# Merge per-subject slopes with mindfulness and conscientiousness scores.
# Both are subject-level (one row per subject in survey_data), so the join
# produces one row per subject in rt_slopes — no duplication.
rt_slopes[
  survey_data[, .(sona_id, mindfulness, conscientiousness)],
  on = "sona_id"
] -> rt_slopes

local({

  # Helper: format a cor.test result as a ggtext-compatible subtitle string
  format_cor_subtitle <- function(ct) {
    paste0(
      "*r*(", ct$parameter, ") ", format_r(ct$estimate),
      ", *p* ", format_p(ct$p.value),
      ", 95% CI [", format_r(ct$conf.int[1]),
      ", ", format_r(ct$conf.int[2]), "]"
    )
  }

  # Helper: compute per-panel correlation labels for a survey ~ RT plot.
  # Uses full_data_subj (one row per subject per condition) so each subject
  # contributes equally. Returns one collapsed label per distractor_type panel.
  make_survey_cor_labels <- function(data, x_var, x_pos = -Inf, y_pos = Inf) {
    as.data.table(data)[
      !is.na(get(x_var)),
      {
        ct <- cor.test(get(x_var), avg_rt)
        .(
          target_present = target_present[1],
          label = paste0(
            ifelse(target_present[1], "Present", "Absent"),
            ": *r*(", ct$parameter, ") ", format_r(ct$estimate),
            ", *p* ", format_p(ct$p.value)
          )
        )
      },
      by = .(distractor_type, target_present)
    ][
      order(distractor_type, target_present)
    ][
      ,
      .(
        label = paste(label, collapse = "<br>"),
        x_pos = x_pos,
        y_pos = y_pos
      ),
      by = distractor_type
    ]
  }

  # Helper: build a faceted scatterplot of avg RT by a given survey score.
  # Faceted by distractor type; color indicates target presence.
  make_survey_rt_plot <- function(data, x_var, x_label) {
    ggplot(
      data    = data[!is.na(get(x_var))],
      mapping = aes(
        x     = get(x_var),
        y     = avg_rt,
        color = factor(target_present, labels = c("Absent", "Present"))
      )
    ) +
      geom_point(alpha = 0.5, size = 2) +
      geom_smooth(method = "lm", se = TRUE) +
      facet_wrap(
        ~distractor_type,
        labeller = as_labeller(c(
          `blue_triangle` = "Blue Triangle",
          `red_blue_mix`  = "Red/Blue Mix",
          `red_circle`    = "Red Circle"
        ))
      ) +
      scale_y_continuous(limits = c(0, mean(vs_data$full_data_subj$avg_rt) +
                                      2 * sd(vs_data$full_data_subj$avg_rt))) +
      labs(
        title    = paste("Response Time by", x_label),
        subtitle = paste("Relationship between", x_label, "and visual search RT"),
        y        = "Average RT (ms)",
        x        = x_label
      ) +
      guides(color = guide_legend(title = "Target")) +
      theme_pcj(
        legend.position      = c(0.98, 1.1),
        legend.key.spacing.x = unit(.5, "in"),
        default_caption      = FALSE
      )
  }

  # Mindfulness: per-panel correlation labels (one r per distractor_type facet)
  mindfulness_slope_labels <- as.data.table(rt_slopes)[
    !is.na(mindfulness),
    {
      ct <- cor.test(mindfulness, slope)
      .(label = paste0(
        "*r*(", ct$parameter, ") ", format_r(ct$estimate),
        ", *p* ", format_p(ct$p.value)
      ))
    },
    by = distractor_type
  ]

  ggplot(
    data    = rt_slopes[!is.na(mindfulness)],
    mapping = aes(x = mindfulness, y = slope)
  ) +
    geom_point(alpha = 0.5, size = 2) +
    geom_smooth(method = "lm", se = TRUE) +
    ggtext::geom_richtext(
      data        = mindfulness_slope_labels,
      mapping     = aes(x = -Inf, y = Inf, label = label),
      hjust       = -0.05,
      vjust       = 1.1,
      size        = 3.5,
      fill        = "white",
      label.color = NA,
      inherit.aes = FALSE
    ) +
    facet_wrap(~distractor_type, labeller = as_labeller(c(
      `blue_triangle` = "Blue Triangle",
      `red_blue_mix`  = "Red/Blue Mix",
      `red_circle`    = "Red Circle"
    ))) +
    labs(
      title    = "Mindfulness Unrelated to Search Efficiency",
      subtitle = NULL,                            # removed: was a single pooled r
      y        = "RT Slope (ms/item)",
      x        = "Mindfulness Score"
    ) +
    theme_pcj(default_caption = FALSE) -> mindfulness_slope_plot

  # Conscientiousness: per-panel correlation labels (one r per distractor_type facet)
  conscientiousness_slope_labels <- as.data.table(rt_slopes)[
    !is.na(conscientiousness),
    {
      ct <- cor.test(conscientiousness, slope)
      .(label = paste0(
        "*r*(", ct$parameter, ") ", format_r(ct$estimate),
        ", *p* ", format_p(ct$p.value)
      ))
    },
    by = distractor_type
  ]

  ggplot(
    data    = rt_slopes[!is.na(conscientiousness)],
    mapping = aes(x = conscientiousness, y = slope)
  ) +
    geom_point(alpha = 0.5, size = 2) +
    geom_smooth(method = "lm", se = TRUE) +
    ggtext::geom_richtext(
      data        = conscientiousness_slope_labels,
      mapping     = aes(x = -Inf, y = Inf, label = label),
      hjust       = -0.05,
      vjust       = 1.1,
      size        = 3.5,
      fill        = "white",
      label.color = NA,
      inherit.aes = FALSE
    ) +
    facet_wrap(~distractor_type, labeller = as_labeller(c(
      `blue_triangle` = "Blue Triangle",
      `red_blue_mix`  = "Red/Blue Mix",
      `red_circle`    = "Red Circle"
    ))) +
    labs(
      title    = "Conscientiousness and Search Efficiency",
      subtitle = NULL,
      y        = "RT Slope (ms/item)",
      x        = "Conscientiousness Score"
    ) +
    theme_pcj(default_caption = FALSE) -> conscientiousness_slope_plot

  # Life satisfaction ~ RT
  satisfaction_cor_labels <- make_survey_cor_labels(
    data  = vs_data$full_data_subj,
    x_var = "satisfaction"
  )

  satisfaction_rt_plot <- make_survey_rt_plot(
    vs_data$full_data_subj, "satisfaction", "Life Satisfaction Score"
  ) +
    ggtext::geom_richtext(
      data    = satisfaction_cor_labels,
      mapping = aes(x = x_pos, y = y_pos, label = label),
      hjust       = -0.05,
      vjust       = 1.1,
      size        = 3.5,
      fill        = "white",
      label.color = NA,
      inherit.aes = FALSE
    ) +
    labs(
      title    = "Life Satisfaction and Visual Search RT:",
      subtitle = "Satisfied People are Faster When Targets are Present"
    )

  # Conscientiousness ~ RT
  conscientiousness_cor_labels <- make_survey_cor_labels(
    data  = vs_data$full_data_subj,
    x_var = "conscientiousness"
  )

  conscientiousness_rt_plot <- make_survey_rt_plot(
    vs_data$full_data_subj, "conscientiousness", "Conscientiousness Score"
  ) +
    ggtext::geom_richtext(
      data    = conscientiousness_cor_labels,
      mapping = aes(x = x_pos, y = y_pos, label = label),
      hjust       = -0.05,
      vjust       = 1.1,
      size        = 3.5,
      fill        = "white",
      label.color = NA,
      inherit.aes = FALSE
    ) +
    labs(
      title    = "Conscientiousness and Visual Search RT:",
      subtitle = "Conscientious People Slower When Targets are Absent"
    )

  # Relationships between survey subscales — one row per subject, no RT involved
  ct_mind_sat <- cor.test(vs_data$subj_scores$mindfulness, vs_data$subj_scores$satisfaction)
  ct_mind_con <- cor.test(vs_data$subj_scores$mindfulness, vs_data$subj_scores$conscientiousness)
  ct_sat_con  <- cor.test(vs_data$subj_scores$satisfaction, vs_data$subj_scores$conscientiousness)

  ggplot(vs_data$subj_scores, aes(x = mindfulness, y = satisfaction)) +
    geom_point() +
    geom_smooth(method = "lm", se = TRUE) +
    labs(
      title    = "Relationship Between Mindfulness and Life Satisfaction",
      subtitle = format_cor_subtitle(ct_mind_sat),
      x        = "Mindfulness Score",
      y        = "Life Satisfaction Score"
    ) +
    theme_pcj(default_caption = FALSE,
              plot.title = ggplot2::element_text(size = ggplot2::rel(2.2))) +
    theme(plot.subtitle = ggtext::element_markdown()) -> mind_sat_plot

  ggplot(vs_data$subj_scores, aes(x = mindfulness, y = conscientiousness)) +
    geom_point() +
    geom_smooth(method = "lm", se = TRUE) +
    labs(
      title    = "Relationship Between Mindfulness and Conscientiousness",
      subtitle = format_cor_subtitle(ct_mind_con),
      x        = "Mindfulness Score",
      y        = "Conscientiousness Score"
    ) +
    theme_pcj(default_caption = FALSE,
              plot.title = ggplot2::element_text(size = ggplot2::rel(2.2))) +
    theme(plot.subtitle = ggtext::element_markdown()) -> mind_con_plot

  ggplot(vs_data$subj_scores, aes(x = satisfaction, y = conscientiousness)) +
    geom_point() +
    geom_smooth(method = "lm", se = TRUE) +
    labs(
      title    = "Relationship Between Life Satisfaction and Conscientiousness",
      subtitle = format_cor_subtitle(ct_sat_con),
      x        = "Life Satisfaction Score",
      y        = "Conscientiousness Score"
    ) +
    theme_pcj(default_caption = FALSE,
              plot.title = ggplot2::element_text(size = ggplot2::rel(2.2))) +
    theme(plot.subtitle = ggtext::element_markdown()) -> sat_con_plot

  plot_results <- list(
    "mindfulness_slope"              = mindfulness_slope_plot,
    "conscientiousness_slope"        = conscientiousness_slope_plot,
    "satisfaction_rt"                = satisfaction_rt_plot,
    "conscientiousness_rt"           = conscientiousness_rt_plot,
    "mindfulness_satisfaction"       = mind_sat_plot,
    "mindfulness_conscientiousness"  = mind_con_plot,
    "conscientiousness_satisfaction" = sat_con_plot
  )

}) -> vs_data$survey_rt_plots

plot_saver(
  plots   = vs_data$survey_rt_plots,
  dir     = "./plots",
  names   = names(vs_data$survey_rt_plots),
  dpi     = 600,
  preview = FALSE,
  width   = 15.5,
  height  = 9
)


# Backup to GitHub ------------------------------------------------------------

git_push(push = TRUE)
